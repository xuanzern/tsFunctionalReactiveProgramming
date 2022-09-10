import "./style.css";
import { interval, fromEvent, of, merge} from 'rxjs'
import { map, filter, scan, reduce} from 'rxjs/operators'
function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */
  const Constants = {
    CANVAS_SIZE: 600,
    GAME_TICK_DURATION: 150,
    FROG_START_X: 250,
    FROG_START_Y: 550,
    FrogWidth: 30,
    FrogHeight: 35,
    MoveChange: 60,
    FrogColour: "yellowgreen",
    //car 
    CarWidth: 55,
    CarHeight: 30,
    CarSeparation: 100,
    RowHeight: 60,
    CarSpacingFromZones: 15,
    CarRow1: 480,
    CarRow2: 420,
    CarRow3: 360,
    CarColour: "red",

    //log
    LogWidth: 100,
    LogHeight: 40,
    LogSeparation: 150,
    LogSpacingFromZones: 10,
    LogRow1: 240,
    LogColour: "brown"
  } as const

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Classes
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  class Tick { constructor(public readonly elapsed:number) {} };
  class Move { constructor(public readonly axis: 'y'|'x', public readonly change: -60 | 60) {}};
  class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}
    add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
    sub = (b:Vec) => this.add(b.scale(-1))
    len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
    scale = (s:number) => new Vec(this.x*s,this.y*s)
    ortho = ()=> new Vec(this.y,-this.x)
    rotate = (deg:number) =>
              (rad =>(
                  (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
                )(Math.cos(rad), Math.sin(rad), this)
              )(Math.PI * deg / 180)
  
    static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
    static Zero = new Vec();
  };

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Observable Streams
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const keydown$ = fromEvent<KeyboardEvent>(document, "keydown");
  const up$ = keydown$.pipe(filter(e => String(e.key) == "w"), map(_ => new Move('y', -60)));
  const down$ = keydown$.pipe(filter(e => String(e.key) == "s"), map(_ => new Move('y', 60)));
  const left$ = keydown$.pipe(filter(e => String(e.key) == "a"), map(_ => new Move('x', -60)));
  const right$ = keydown$.pipe(filter(e => String(e.key) == "d"), map(_ => new Move('x', 60)));

  const tick$ = interval(Constants.GAME_TICK_DURATION).pipe(
    map(number => new Tick(number))
  );
  
  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Types  
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  type ViewType = "frog" | "car" | "log";

  type Body = Readonly<{
    id: string,
    viewType: ViewType,
    x: number,
    y: number,
    width: number,
    height: number
    colour: string
  }>

  type State = Readonly<{
    frog: Body,
    cars: Readonly<Body[]>,
    logs: Readonly<Body[]>,
    gameOver: boolean
  }>

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Physics/Creation Functions 
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const torusWrap = (x: number) => { 
    const s=Constants.CANVAS_SIZE, 
      wrap = (v:number) => v < 0 ? 
                        v + s : 
                            v > s ? 
                            v - s : v;
    return wrap(x);
  }

  //https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  const handleCollisions = (s: State) => {
    const bodiesCollided = ([a,b]: [Body, Body]) => 
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.height + a.y > b.y
    const frogCollidedWithCar = s.cars.filter(r => bodiesCollided([s.frog,r])).length > 0
    const frogCollideWithLog = s.logs.filter(r => bodiesCollided([s.frog,r])).length > 0

    return <State>{
      ...s,
      gameOver: frogCollidedWithCar
    }
  }

  const createBody = (id: String, bodyType: ViewType, x: number, y: number, w: number, h: number, c: String) => 
    <Body>{
      id: id,
      viewType: bodyType,
      x: x,
      y: y,
      width: w,
      height: h,
      colour: c
    }

  function createCarsForEachCarRow(colNum: number, rowNum: number, cars: Body[]): Body[]{
    function createCars(colNum: number, rowNum: number, cars: Body[]): Body[]{
      return colNum === 0 ? 
        cars : 
        createCars(colNum-1, rowNum, cars.concat(
          createBody("car" + colNum + rowNum, 
                      "car", 
                      colNum*(Constants.CarWidth + Constants.CarSeparation),
                      rowNum,
                      Constants.CarWidth,
                      Constants.CarHeight,
                      Constants.CarColour
                      )
          )
        )
    }
    return rowNum > Constants.CarRow1?
      cars : cars.concat(createCarsForEachCarRow(colNum, rowNum + Constants.RowHeight, createCars(colNum, rowNum+Constants.RowHeight,cars)))
  }
  
  function createLogs(colNum: number, rowNum: number, cars: Body[]): Body[]{
    return colNum === 0 ? 
      cars : 
      createLogs(colNum-1, rowNum, cars.concat(
        createBody("log" + colNum + rowNum, 
                    "log", 
                    colNum*(Constants.LogWidth + Constants.LogSeparation),
                    rowNum,
                    Constants.LogWidth,
                    Constants.LogHeight,
                    Constants.LogColour
                    )
        )
      )
  }

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Creation and Update
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const attr = (e:Element, o:{ [key: string|number]: Object }) =>
    { for(const k in o) e.setAttribute(k,String(o[k])) }

  const initialState: State ={
    frog: createBody(
          "frog",
          "frog", 
          Constants.FROG_START_X, 
          Constants.FROG_START_Y,
          Constants.FrogWidth,
          Constants.FrogHeight,
          Constants.FrogColour
        ),
    cars: createCarsForEachCarRow(3, Constants.CarRow3 - Constants.RowHeight + Constants.CarSpacingFromZones, []),
    logs: createLogs(3, Constants.LogRow1 + Constants.LogSpacingFromZones, []),
    gameOver: false
  }

  const reduceState = (currentState: State, event: Move|Tick): State => {
    if (event instanceof Move){
      const newState = <State>{...currentState, frog: {
        ...currentState.frog, 
        x: event.axis === 'x' ? (torusWrap(currentState.frog.x + event.change)) : currentState.frog.x,
        y: event.axis === 'y' ? (currentState.frog.y + event.change) : currentState.frog.y,
      }
      }
      return handleCollisions(newState);
    }else if (event instanceof Tick){
      const newState = <State>{
        ...currentState,
        cars: (currentState.cars.map((car: Body) => {
          return {...car, x: torusWrap(car.x+10)};
        })),
        logs: (currentState.logs.map((log: Body) => {
          return {...log, x: torusWrap(log.x+50)};
        }))
      }
      return handleCollisions(newState);
    } else {
      return currentState
    }
  }

  function updateView(s: State){
    const canvas = document.getElementById("svgCanvas")!;
    const frog = document.getElementById(s.frog.id);
  
    /*
    From asteroids code
    */
    const updateBodyView = (b:Body) => {
        function createBodyView() {
          const v = document.createElementNS(canvas.namespaceURI, "rect")!;
          attr(v,{id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, style: `fill: ${b.colour}`});
          v.classList.add(b.viewType)
          canvas.appendChild(v)
          return v;
        }
        const v = document.getElementById(b.id) || createBodyView();
        attr(v,{x: b.x,cy: b.y});
      };

    //cars
    s.cars.forEach((carState: Body) => {
      const car = document.getElementById(carState.id);
      updateBodyView(carState);
      }
    )
    
    //logs
    s.logs.forEach((logState: Body) => {
      const log = document.getElementById(logState.id);
      updateBodyView(logState);
      }
    )

    updateBodyView(s.frog);
    //frog
    if (frog){
      frog.setAttribute("x", String(s.frog.x));
      frog.setAttribute("y", String(s.frog.y));
      if (s.gameOver === true){
        frog.setAttribute(
          "style",
          "fill: red"
        )
      }else{
        frog.setAttribute(
          "style",
          "fill: yellowgreen"
        )
      }
    }
  }

  merge(up$, down$, left$, right$, tick$).pipe(scan(reduceState, initialState)).subscribe(updateView);
}
// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
