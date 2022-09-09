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
    CanvasSize: 600,
    GameTickDuration: 150,
    FrogStartX: 250,
    FrogStartY: 550,
    FrogWidth: 30,
    FrogHeight: 35,
    MoveChange: 60,
    CarWidth: 55,
    CarHeight: 30,
    CarSeparation: 100,
    RowHeight: 60,
    CarSpacingFromZones: 15,
    CarRow1: 480,
    CarRow2: 420,
    CarRow3: 360,
    LogWidth: 100,
    LogHeight: 40,
    LogSeparation: 150,
    LogSpacingFromZones: 10,
    LogRow1: 240
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

  const tick$ = interval(Constants.GameTickDuration).pipe(
    map(number => new Tick(number))
  );
  
  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Types  
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  type BodyType = "frog" | "car" | "log";

  type Body = Readonly<{
    id: string,
    bodyType: BodyType,
    x: number,
    y: number,
    w: number,
    h: number
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
    const s=Constants.CanvasSize, 
      wrap = (v:number) => v < 0 ? 
                        v + s : 
                            v > s ? 
                            v - s : v;
    return wrap(x);
  }

  //https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  const handleCollisions = (s: State) => {
    const bodiesCollided = ([a,b]: [Body, Body]) => 
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.h + a.y > b.y
    const frogCollidedWithCar = s.cars.filter(r => bodiesCollided([s.frog,r])).length > 0
    const frogCollideWithLog = s.logs.filter(r => bodiesCollided([s.frog,r])).length > 0

    return <State>{
      ...s,
      gameOver: frogCollidedWithCar
    }
  }

  const createBody = (id: String, bodyType: BodyType, x: number, y: number, w: number, h: number) => 
    <Body>{
      id: id,
      bodyType: bodyType,
      x: x,
      y: y,
      w: w,
      h: h,
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
                      Constants.CarHeight
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
                    Constants.LogHeight
                    )
        )
      )
  }

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Creation and Update
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const initialState: State ={
    frog: createBody(
          "frog",
          "frog", 
          Constants.FrogStartX, 
          Constants.FrogStartY,
          Constants.FrogWidth,
          Constants.FrogHeight
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
          return {...log, x: torusWrap(log.x+10)};
        }))
      }
      return handleCollisions(newState);
    } else {
      return currentState
    }
  }


  // const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  // // Example on adding an element
  // const circle = document.createElementNS(svg.namespaceURI, "circle");
  // circle.setAttribute("r", "10");
  // circle.setAttribute("cx", "100");
  // circle.setAttribute("cy", "280");
  // circle.setAttribute(
  //   "style",
  //   "fill: green; stroke: green; stroke-width: 1px;"
  // );
  // svg.appendChild(circle);

  function updateView(s: State){
    const canvas = document.getElementById("svgCanvas")!;
    const frog = document.getElementById(s.frog.id);
    //cars
    s.cars.forEach((carState: Body) => {
      const car = document.getElementById(carState.id);

      if (car === null){
        const newCar = document.createElementNS(canvas.namespaceURI, "rect");

        newCar.setAttribute("id", carState.id);
        newCar.setAttribute("width", String(Constants.CarWidth));
        newCar.setAttribute("height", String(Constants.CarHeight));
        newCar.setAttribute("x", String(carState.x));
        newCar.setAttribute("y", String(carState.y));
        newCar.setAttribute(
          "style",
          "fill: red"
        )
        canvas.appendChild(newCar)
      } 
      else{
        car.setAttribute("x", String(carState.x));
      }
    }
    )
    

    s.logs.forEach((logState: Body) => {
      const log = document.getElementById(logState.id);

      if (log === null){
        const newLog = document.createElementNS(canvas.namespaceURI, "rect");

        newLog.setAttribute("id", logState.id);
        newLog.setAttribute("width", String(Constants.LogWidth));
        newLog.setAttribute("height", String(Constants.LogHeight));
        newLog.setAttribute("x", String(logState.x));
        newLog.setAttribute("y", String(logState.y));
        newLog.setAttribute(
          "style",
          "fill: brown"
        )
        canvas.appendChild(newLog)
      } 
      else{
        log.setAttribute("x", String(logState.x));
      }
    }
    )

    //frog
    if (frog === null){
      const newFrog = document.createElementNS(canvas.namespaceURI, "rect");
      newFrog.setAttribute("id", s.frog.id);
      newFrog.setAttribute("width", String(Constants.FrogWidth));
      newFrog.setAttribute("height", String(Constants.FrogHeight));
      newFrog.setAttribute("x", String(s.frog.x));
      newFrog.setAttribute("y", String(s.frog.y));
      newFrog.setAttribute(
        "style",
        "fill: yellowgreen"
      );
      canvas.appendChild(newFrog);
    } else{
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
