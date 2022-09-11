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
    FROG_START_X: 255,
    FROG_START_Y: 555,
    FrogWidth: 30,
    FrogHeight: 30,
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
    LogColour: "brown",

    TargetAreaPosX: 50,

    ScorePosX: 10, 
    ScorePosY: 35
  } as const

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Classes
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  class Tick { constructor(public readonly elapsed:number) {} };
  class Move { constructor(public readonly axis: 'y'|'x', public readonly change: -60 | 60) {}};
  class RNG {
    // LCG using GCC's constants
    m = 0x80000000; // 2**31
    a = 1103515245;
    c = 12345;
    state: number;
    constructor(seed: number) {
      this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
    }
    nextInt() {
      this.state = (this.a * this.state + this.c) % this.m;
      return this.state;
    }
    nextFloat() {
      // returns in range [0,1]
      return this.nextInt() / (this.m - 1);
    } 
  }

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
  type Direction = -1|0|1 //-1 stands for left, 1 stands for right, 0 stands for user controlled object

  type ViewType = "frog" | "car" | "log";

  type Body = Readonly<{
    id: string,
    viewType: ViewType,
    x: number,
    y: number,
    width: number,
    height: number,
    colour: string,
    direction: number
    // speed: number  //frog doesn't have speed attribute
  }>

  type State = Readonly<{
    frog: Body,
    cars: Readonly<Body[]>,
    logs: Readonly<Body[]>,
    winPositions: Readonly<[]>,
    gameOver: boolean,
  }>

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Physics/Creation Functions 
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const nextRandom = () => {
    /**
     * returns a random number in the range [0, 3]
     */
    const rng = new RNG(1);
    return rng.nextFloat() * 3;
  }

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

  const createBody = (id: String, bodyType: ViewType, x: number, y: number, w: number, h: number, c: String, d: number)=> 
    <Body>{
      id: id,
      viewType: bodyType,
      x: x,
      y: y,
      width: w,
      height: h,
      colour: c,
      direction: d
    }

  function createObstacles(numberPerRow: number, startRow: number, rows: number, viewType: ViewType, direction: number, obstacles: Body[]): Body[] {
    const width= (viewType === "car") ? Constants.CarWidth : Constants.LogWidth;
    const height = (viewType === "car") ? Constants.CarHeight : Constants.LogHeight;
    const separation = (viewType === "car") ? Constants.CarSeparation : Constants.LogSeparation;
    const colour = (viewType === "car") ? Constants.CarColour : Constants.LogColour;
    
    function createObstaclesForOneRow(numberPerRow: number, rowNum: number, direction: number, obstacles: Body[]): Body[]{
      return numberPerRow === 0?
      obstacles :
      createObstaclesForOneRow(numberPerRow-1, rowNum, direction, obstacles.concat(
        createBody(
          String(viewType) + numberPerRow + rowNum,
          viewType,
          numberPerRow*(width + separation),
          rowNum, 
          width,
          height,
          colour,
          direction
        )
      ))
    }

    return rows === 0 ?
      obstacles : obstacles.concat(createObstacles(numberPerRow, startRow + Constants.RowHeight, rows - 1, viewType, direction*-1,
        createObstaclesForOneRow(numberPerRow, startRow + Constants.RowHeight, direction*-1, obstacles)))
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
          Constants.FrogColour,
          0
        ),
    cars: createObstacles(3, Constants.CarRow3 - Constants.RowHeight + Constants.CarSpacingFromZones, 3, "car", 1, []),
    logs: createObstacles(2, Constants.LogRow1 - Constants.RowHeight + Constants.LogSpacingFromZones, 1, "log", 1, []),
    winPositions: [],
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
          return {...car, x: torusWrap(car.x + car.direction*(car.y/100*5))};
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
        attr(v,{x: b.x,y: b.y});
      };

    //cars
    s.cars.forEach((carState: Body) => {
      updateBodyView(carState);
      }
    )

    //logs
    s.logs.forEach((logState: Body) => {
      updateBodyView(logState);
      }
    )

    updateBodyView(s.frog);
    
    const v = document.createElementNS(canvas.namespaceURI, "text");
    attr(v, {x: Constants.ScorePosX, y: Constants.ScorePosY, style: "fill: white"});
    v.textContent = "Score:";
    canvas.appendChild(v)
    //Frog dies
    if (s.gameOver === true){ 
      subscription$.unsubscribe(); 
      
      
      keydown$.pipe(filter(e => String(e.key) === 'r')).subscribe(_ => main());
    }
  }

  const subscription$ = merge(up$, down$, left$, right$, tick$).pipe(scan(reduceState, initialState)).subscribe(updateView);
}
// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
