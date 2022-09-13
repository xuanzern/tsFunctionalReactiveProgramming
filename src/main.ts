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
    FrogDeadColour: "red",

    //car 
    CarWidth: 55,
    CarHeight: 30,
    CarSeparation: 100,
    RowHeight: 60,
    CarSpacingFromZones: 15,
    CarTopRow: 360,
    CarColour: "orange",

    //log
    LogWidth: 100,
    LogHeight: 40,
    LogSeparation: 150,
    LogSpacingFromZones: 10,
    LogTopRow: 120,
    LogColour: "brown",

    //river
    RiverWidth: 600,
    RiverX: 0,
    RiverY: 120,
    RiverHeight: 180,
    RiverColour: "dodgerblue",

    TargetAreaWidth: 30,
    TargetAreaHeight: 30,
    TargetAreaRow: 75,
    TargetArea1X: 75,
    TargetArea2X: 255,
    TargetArea3X: 435,
    TargetAreaColour: "lightgray",

    //coordinates for score in canvas
    ScorePosX: 10, 
    ScorePosY: 25,
    HighScorePosY: 45
  } as const

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Classes
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  class Tick { constructor(public readonly elapsed:number) {} };
  class Move { constructor(public readonly axis: 'y'|'x', public readonly change: -60 | 60) {}};
  class Restart { constructor(){} };

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

  const restart$ = keydown$.pipe(filter(e => String(e.key) == "r"), map(_ => new Restart()));

  const tick$ = interval(Constants.GAME_TICK_DURATION).pipe(
    map(number => new Tick(number))
  );
  
  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Types  
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  type Direction = -1|0|1 //-1 stands for left, 1 stands for right, 0 stands for user controlled object

  type ViewType = "frog" | "car" | "log" | "river" | "targetArea";

  type Body = Readonly<{
    id: string,
    viewType: ViewType,
    x: number,
    y: number,
    width: number,
    height: number,
    colour: string,
    speed: number,
    direction: Direction
  }>

  type State = Readonly<{
    frog: Body,
    cars: Readonly<Body[]>,
    logs: Readonly<Body[]>,
    river: Body,
    targetAreas: Readonly<Body[]>,
    gameOver: boolean,
    score: number,
    highScore: number
  }>

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Physics/Creation Functions 
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const torusWrap = (x: number): number => { 
    const s=Constants.CANVAS_SIZE, 
      wrap = (v:number) => v < 0 ? 
                        v + s : 
                            v > s ? 
                            v - s : v;
    return wrap(x);
  }

  const oppositeDirection = (n: Direction): Direction => {
    return n === -1 ? 1 : -1;
  }

  const handleCollisions = (s: State): State => {
    /**
     * Function to ahndle all collisions in the game
     * Modified from asteroids05.ts
     * Collision logic from:
     * https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection 
     */
    const bodiesCollided = ([a,b]: [Body, Body]): boolean => 
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.height + a.y > b.y
    const frogCollidedWithCar = s.cars.filter(r => bodiesCollided([s.frog,r])).length > 0;
    const frogCollidedWithLog = s.logs.filter(r => bodiesCollided([s.frog,r])).length > 0;
    const frogCollidedWithRiver = bodiesCollided([s.frog, s.river]);
    
    return <State>{
      ...s,
      gameOver: frogCollidedWithCar || (!frogCollidedWithLog &&frogCollidedWithRiver)
    }
  }

  const createBody = (id: String, bodyType: ViewType, x: number, y: number, w: number, h: number, c: String, s: number, d: Direction): Body => 
    <Body>{
      id: id,
      viewType: bodyType,
      x: x,
      y: y,
      width: w,
      height: h,
      colour: c,
      speed: s,
      direction: d
    }

  function createObstacles(numberPerRow: number, startRow: number, rows: number, viewType: ViewType, speed: number, direction: Direction, obstacles: Body[]): Body[] {
    const width= (viewType === "car") ? Constants.CarWidth : Constants.LogWidth;
    const height = (viewType === "car") ? Constants.CarHeight : Constants.LogHeight;
    const separation = (viewType === "car") ? Constants.CarSeparation : Constants.LogSeparation;
    const colour = (viewType === "car") ? Constants.CarColour : Constants.LogColour;
    
    function createObstaclesForOneRow(numberPerRow: number, rowNum: number, speed: number, direction: Direction, obstacles: Body[]): Body[]{
      return numberPerRow === 0?
      obstacles :
      createObstaclesForOneRow(numberPerRow-1, rowNum, speed, direction, obstacles.concat(
        createBody(
          String(viewType) + numberPerRow + rowNum,
          viewType,
          numberPerRow*(width + separation),
          rowNum, 
          width,
          height,
          colour,
          speed,
          direction
        )
      ))
    }

    return rows === 0 ?
      obstacles : obstacles.concat(createObstacles(numberPerRow, startRow + Constants.RowHeight, rows - 1, viewType, speed-0.5, oppositeDirection(direction),
        createObstaclesForOneRow(numberPerRow, startRow + Constants.RowHeight, speed-0.5, oppositeDirection(direction), obstacles)))
  }

  function createTargetAreas(): Body[]{
    const targetArea1 = createBody("targetArea", "targetArea", Constants.TargetArea1X, Constants.TargetAreaRow, Constants.TargetAreaWidth, Constants.TargetAreaHeight, Constants.TargetAreaColour,0,0);
    const targetArea2 = createBody("targetArea2", "targetArea", Constants.TargetArea2X, Constants.TargetAreaRow, Constants.TargetAreaWidth, Constants.TargetAreaHeight, Constants.TargetAreaColour,0,0);
    const targetArea3 = createBody("targetArea3", "targetArea", Constants.TargetArea3X, Constants.TargetAreaRow, Constants.TargetAreaWidth, Constants.TargetAreaHeight, Constants.TargetAreaColour,0,0);
    return [targetArea1, targetArea2, targetArea3];
  }

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game States and Update
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
          0,
          0
        ),
    cars: createObstacles(3, Constants.CarTopRow - Constants.RowHeight + Constants.CarSpacingFromZones, 3, "car", 2.5, 1, []),
    logs: createObstacles(2, Constants.LogTopRow - Constants.RowHeight + Constants.LogSpacingFromZones, 3, "log", 2, 1, []),
    river: createBody("river", "river", Constants.RiverX, Constants.RiverY, Constants.RiverWidth, Constants.RiverHeight, Constants.RiverColour, 0, 0),  
    targetAreas: createTargetAreas(),
    gameOver: false,
    score: 0,
    highScore: 0
  }

  const reduceState = (currentState: State, event: Move|Tick|Restart): State => {
    /**
     * state transducer
     */
    if (!currentState.gameOver){
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
            return {...car, x: torusWrap(car.x + car.direction*car.speed*10)};
          })),
          logs: (currentState.logs.map((log: Body) => {
            return {...log, x: torusWrap(log.x+ log.direction*log.speed*10)};
          }))
        }
        return handleCollisions(newState);
      } else if (event instanceof Restart){
        return {...initialState, highScore: currentState.highScore};
      } else {
        return currentState;
      }
    } else{
        if (event instanceof Restart){
          return {...initialState, highScore: currentState.highScore};
        }
        return currentState;
    }
  }

  function updateView(s: State){
    /**
     * Updates the attributes of all objects in the html.
     * This is the only IMPURE function in this program
     */
    const canvas = document.getElementById("svgCanvas")!;
    
    /*
    From asteroids05.ts
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
    
    updateBodyView(s.river);

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

    s.targetAreas.forEach((targetAreaState: Body) => {
      updateBodyView(targetAreaState);
    }
    )
    updateBodyView(s.frog);
    
    
    const updateScoreView = () => {
      function createScoreView(){
        const score = document.createElementNS(canvas.namespaceURI, "text");
        attr(score, {id: "score", x: Constants.ScorePosX, y: Constants.ScorePosY, style: "fill: white"});
        canvas.appendChild(score);
        return score;
      }

      function createHighScoreView(){
        const highScore = document.createElementNS(canvas.namespaceURI, "text");
        attr(highScore, {id: "highScore", x: Constants.ScorePosX, y: Constants.HighScorePosY, style: "fill: white"});
        canvas.appendChild(highScore);
        return highScore;
      }

      const u = document.getElementById("score") || createScoreView();
      const v = document.getElementById("highScore") || createHighScoreView();

      u.textContent = "Score: " + s.score;
      v.textContent = "High Score: " + s.highScore;
    }
    
    updateScoreView();

    if (s.gameOver){
      const frog = document.getElementById("frog")!;
      attr(frog, {style: "fill: "+ Constants.FrogDeadColour});
    } else{
      const frog = document.getElementById("frog")!;
      attr(frog, {style: "fill: "+ Constants.FrogColour});
    }
  }

  merge(restart$, up$, down$, left$, right$, tick$).pipe(scan(reduceState, initialState)).subscribe(updateView);
}
// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
