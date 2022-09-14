import "./style.css";
import { interval, fromEvent, merge} from 'rxjs'
import { map, filter, scan} from 'rxjs/operators'
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
  const CONSTANTS = {
    CANVAS_SIZE: 600,
    GAME_TICK_DURATION: 150,
    FROG_START_X: 255,
    FROG_START_Y: 555,
    FROG_WIDTH: 30,
    FROG_HEIGHT: 30,
    MOVE_CHANGE: 60,   
    FROG_COLOUR: "yellowgreen",
    FROG_DEAD_COLOUR: "red",

    OBSTACLE_SPEED: 5,
    DIFFICULTY_MULTIPLIER: 1.5,
    ROW_HEIGHT: 60,
    SPEED_CHANGE_FOR_EACH_ROW: 0.5,
    
    //car 
    CAR_WIDTH: 55,
    CAR_HEIGHT: 30,
    CAR_SEPARATION: 100,
    CAR_SPACING_FROM_ZONES: 15,
    CAR_TOP_ROW: 360,
    CAR_COLOUR: "orange",

    //log
    LOG_WIDTH: 100,
    LOG_HEIGHT: 40,
    LOG_SEPARATION: 150,
    LOG_SPACING_FROM_ZONES: 10,
    LOG_TOP_ROW: 120,
    LOG_COLOUR: "brown",

    //river
    RIVER_WIDTH: 600,
    RIVER_X: 0,
    RIVER_Y: 120,
    RIVER_HEIGHT: 180,
    RIVER_COLOUR: "dodgerblue",

    //Target Area
    TARGET_AREA_WIDTH: 30,
    TARGET_AREA_HEIGHT: 30,
    TARGET_AREA_ROW: 75,
    TARGET_AREA_1_X: 75,
    TARGET_AREA_2_X: 255,
    TARGET_AREA_3_X: 435,
    TARGET_AREA_COLOUR: "white",
    TARGET_AREA_OCCUPIED_COLOUR: "dimgray",

    //coordinates for scores and levels in canvas
    SCORE_POS_X: 10, 
    SCORE_POS_Y: 25,
    HIGH_SCORE_POS_Y: 45,
    LEVEL_POS_X: 500,
    LEVEL_POS_Y: 35

  } as const

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Classes
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  // Tick object for non-player-controlled movements
  class Tick { constructor(public readonly elapsed:number) {} };

  // Move class for moving the frog
  class Move { constructor(public readonly axis: 'y'|'x', public readonly change: -60 | 60) {}};

  // Restart class for restarting the game
  class Restart { constructor(){} };


  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Observable Streams
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  const keydown$ = fromEvent<KeyboardEvent>(document, "keydown"); //observable stream for when a key is pressed

  // observable streams for controlling the frog's movements. 
  const up$ = keydown$.pipe(filter(e => String(e.key) == "w"), map(_ => new Move('y', -60))); 
  const down$ = keydown$.pipe(filter(e => String(e.key) == "s"), map(_ => new Move('y', 60)));
  const left$ = keydown$.pipe(filter(e => String(e.key) == "a"), map(_ => new Move('x', -60)));
  const right$ = keydown$.pipe(filter(e => String(e.key) == "d"), map(_ => new Move('x', 60)));

  // observable stream for restarting the game
  const restart$ = keydown$.pipe(filter(e => String(e.key) == "r"), map(_ => new Restart()));

  // observable stream for non-player-controlled objects
  const tick$ = interval(CONSTANTS.GAME_TICK_DURATION).pipe(
    map(number => new Tick(number))
  );
  

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Types  
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  //-1 stands for left, 1 stands for right, 0 stands for user controlled object or non-moving object
  type Direction = -1|0|1 
  
  // types of bodies involved in collision
  type ViewType = "frog" | "car" | "log" | "river" | "targetArea";

  // every object that involved in collision is a body
  type Body = Readonly<{
    id: string,
    viewType: ViewType,
    x: number,
    y: number,
    width: number,
    height: number,
    colour: string,
    speed: number,      //frog and river has a speed of 0  (player-controlled/non-moving)
    direction: Direction, //frog and river has direction of 0 (player-controlled/non-moving)
    occupied: boolean   //other than viewType TargetArea, this will always be false
  }>;

  // stores the state of the game
  type State = Readonly<{
    frog: Body,
    cars: Readonly<Body[]>,
    logs: Readonly<Body[]>,
    river: Body,
    targetAreas: Readonly<Body[]>,
    gameOver: boolean,
    score: number,
    highScore: number,
    level: number
  }>


  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game Physics/Creation Functions 
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  /**
   * Wraps a moving body around the left and right edges of the screen
   * Adapted from asteroids05.ts
   */
  const torusWrap = (x: number): number => { 
    const s=CONSTANTS.CANVAS_SIZE, 
      wrap = (v:number) => v < 0 ? 
                        v + s : 
                            v > s ? 
                            v - s : v;
    return wrap(x);
  }

  // returns the oppostie direction to the input n. When given 1, returns -1. When give -1, returns 1.
  const oppositeDirection = (n: Direction): Direction => {
    return n === -1 ? 1 : -1;
  }

  
  /**
   * Function to handle all collisions in the game given a state
   * Game over when frog collides with river or car
   * Modified from asteroids05.ts
   * Collision logic from:
   * https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection 
   */
  const handleCollisions = (s: State): State => {
    const bodiesCollided = ([a,b]: [Body, Body]): boolean =>  // collision boolean
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.height + a.y > b.y,
      frogCollidedWithCar = s.cars.filter(r => bodiesCollided([s.frog,r])).length > 0,  // boolean - frog collided with car
      frogCollidedWithLog = s.logs.filter(r => bodiesCollided([s.frog,r])).length > 0,  // boolean - frog collided with log
      frogCollidedWithRiver = bodiesCollided([s.frog, s.river]),         // boolean- frog collided with river
      targetAreasFilled = s.targetAreas.filter(r => r.occupied).length >= 3, // boolean - all target areas filled 
      frogCollidedWithTargetArea = s.targetAreas.filter(r => bodiesCollided([s.frog, r])).length > 0; //boolean - frog collided with target area
    
    return <State>{
      ...s,
      frog: {...s.frog, x: frogCollidedWithTargetArea? CONSTANTS.FROG_START_X : s.frog.x, y: frogCollidedWithTargetArea? CONSTANTS.FROG_START_Y : s.frog.y},
      targetAreas: (s.targetAreas.map((targetArea: Body) => {
        const scored = bodiesCollided([targetArea, s.frog])
        return {...targetArea, occupied: targetAreasFilled ? false: targetArea.occupied? targetArea.occupied : scored };
      })),
      score: targetAreasFilled ? s.score + 1*s.level: s.score,
      highScore: s.score > s.highScore ? s.score : s.highScore,
      gameOver: frogCollidedWithCar || (!frogCollidedWithLog &&frogCollidedWithRiver),
      level: targetAreasFilled? s.level + 1: s.level
    }
  }

  // creates a body object given the parameters
  const createBody = (id: String, viewType: ViewType, x: number, y: number, w: number, h: number, c: String, s: number, d: Direction): Body => 
    <Body>{
      id: id,
      viewType: viewType,
      x: x,
      y: y,
      width: w,
      height: h,
      colour: c,
      speed: s,
      direction: d
    }

  /**
   * Creates obstacles given the following parameters
   * @param numberPerRow numbers of obstacles per row
   * @param startRow  starting row
   * @param rows    number of rows of obstacles to create
   * @param viewType  viewType of the Body (obstacle)
   * @param speed   speed of the obstacle
   * @param direction   direction of the obstacle
   * @param obstacles   Body array of obstacles
   * @returns a Body array (obstacles)
   */
  function createObstacles(numberPerRow: number, startRow: number, rows: number, viewType: ViewType, speed: number, direction: Direction, obstacles: Body[]): Body[] {
    const width= (viewType === "car") ? CONSTANTS.CAR_WIDTH : CONSTANTS.LOG_WIDTH,
      height = (viewType === "car") ? CONSTANTS.CAR_HEIGHT : CONSTANTS.LOG_HEIGHT,
      separation = (viewType === "car") ? CONSTANTS.CAR_SEPARATION : CONSTANTS.LOG_SEPARATION,
      colour = (viewType === "car") ? CONSTANTS.CAR_COLOUR : CONSTANTS.LOG_COLOUR;
    
    // function to create obstacles for one row
    // written with reference to PASS week 6 code (createAliens)
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
      obstacles : obstacles.concat(createObstacles(numberPerRow, startRow + CONSTANTS.ROW_HEIGHT, rows - 1, viewType, speed-CONSTANTS.SPEED_CHANGE_FOR_EACH_ROW, oppositeDirection(direction),
        createObstaclesForOneRow(numberPerRow, startRow + CONSTANTS.ROW_HEIGHT, speed-CONSTANTS.SPEED_CHANGE_FOR_EACH_ROW, oppositeDirection(direction), obstacles)))
  }

  // function used to create the target areas where the frog goes to
  function createTargetAreas(): Body[]{
    const targetArea1 = createBody("targetArea", "targetArea", CONSTANTS.TARGET_AREA_1_X, CONSTANTS.TARGET_AREA_ROW, CONSTANTS.TARGET_AREA_WIDTH, CONSTANTS.TARGET_AREA_HEIGHT, CONSTANTS.TARGET_AREA_COLOUR,0,0),
      targetArea2 = createBody("targetArea2", "targetArea", CONSTANTS.TARGET_AREA_2_X, CONSTANTS.TARGET_AREA_ROW, CONSTANTS.TARGET_AREA_WIDTH, CONSTANTS.TARGET_AREA_HEIGHT, CONSTANTS.TARGET_AREA_COLOUR,0,0),
      targetArea3 = createBody("targetArea3", "targetArea", CONSTANTS.TARGET_AREA_3_X, CONSTANTS.TARGET_AREA_ROW, CONSTANTS.TARGET_AREA_WIDTH, CONSTANTS.TARGET_AREA_HEIGHT, CONSTANTS.TARGET_AREA_COLOUR,0,0);
    return [targetArea1, targetArea2, targetArea3];
  }


  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Game States and Update
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  /**
   * Sets the number of attributes on an Element at once
   * Taken from asteroidsts.05/course notes
   * @param e  the Element
   * @param o  a property bag
   */
  const attr = (e:Element, o:{ [key: string|number]: Object }) =>
    { for(const k in o) e.setAttribute(k,String(o[k])) }

  // returns the initial state of the game
  const initialState: State ={
    frog: createBody(
          "frog",
          "frog", 
          CONSTANTS.FROG_START_X, 
          CONSTANTS.FROG_START_Y,
          CONSTANTS.FROG_WIDTH,
          CONSTANTS.FROG_HEIGHT,
          CONSTANTS.FROG_COLOUR,
          0,
          0
        ),
    cars: createObstacles(3, CONSTANTS.CAR_TOP_ROW - CONSTANTS.ROW_HEIGHT + CONSTANTS.CAR_SPACING_FROM_ZONES, 3, "car", 2.5, 1, []),
    logs: createObstacles(2, CONSTANTS.LOG_TOP_ROW - CONSTANTS.ROW_HEIGHT + CONSTANTS.LOG_SPACING_FROM_ZONES, 3, "log", 2, 1, []),
    river: createBody("river", "river", CONSTANTS.RIVER_X, CONSTANTS.RIVER_Y, CONSTANTS.RIVER_WIDTH, CONSTANTS.RIVER_HEIGHT, CONSTANTS.RIVER_COLOUR, 0, 0),  
    targetAreas: createTargetAreas(),
    gameOver: false,
    score: 0,
    highScore: 0,
    level: 1
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
            return {...car, x: torusWrap(car.x + car.direction*(car.speed*CONSTANTS.OBSTACLE_SPEED + currentState.level*CONSTANTS.DIFFICULTY_MULTIPLIER))};
          })),
          logs: (currentState.logs.map((log: Body) => {
            return {...log, x: torusWrap(log.x+ log.direction*(log.speed*CONSTANTS.OBSTACLE_SPEED + currentState.level*CONSTANTS.DIFFICULTY_MULTIPLIER))};
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

  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      HTML Update (IMPURE)
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
 
  /**
   * Updates the attributes of all objects in the html.
   * This is the only IMPURE function in this program
   * Updates the HTML view according to the current state of the game
   */
  function updateView(s: State){
    const canvas = document.getElementById("svgCanvas")!;
    
    // from asteroids05.ts
    // Given a body, returns the HTML object represeting the body
    function createBodyView(b:Body): Element {
      const v = document.createElementNS(canvas.namespaceURI, "rect")!;
      attr(v,{id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, style: "fill: " + b.colour});
      v.classList.add(b.viewType)
      canvas.appendChild(v)
      return v;
    }

    // From asteroids05.ts
    // Updates the view in the HTML of an object
    const updateBodyView = (b:Body) => {
        const v = document.getElementById(b.id) || createBodyView(b);
        attr(v,{x: b.x,y: b.y});
      };
    
    // Update view for river
    updateBodyView(s.river);

    // Update view for all cars
    s.cars.forEach((carState: Body) => {
      updateBodyView(carState);
      }
    )

    // Update view for all logs
    s.logs.forEach((logState: Body) => {
      updateBodyView(logState);
      }
    )

    // Update view for all target areas
    s.targetAreas.forEach((targetAreaState: Body) => {
      const v = document.getElementById(targetAreaState.id) || createBodyView(targetAreaState);
      targetAreaState.occupied ? attr(v, {style: "fill: " + CONSTANTS.TARGET_AREA_OCCUPIED_COLOUR}) : attr(v, {style: "fill: " + CONSTANTS.TARGET_AREA_COLOUR})
    }
    )

    // Update view for the frog
    updateBodyView(s.frog);
    const frog = document.getElementById("frog")!;

    // updates the colour of the frog when the frog dies
    s.gameOver ? attr(frog, {style: "fill: "+ CONSTANTS.FROG_DEAD_COLOUR}) : attr(frog, {style: "fill: "+ CONSTANTS.FROG_COLOUR});
    
    // updates the scores and the level of the game on the canvas
    const updateScoreLevelView = () => {

      //create score view on HTML
      function createScoreView(){
        const score = document.createElementNS(canvas.namespaceURI, "text");
        attr(score, {id: "score", x: CONSTANTS.SCORE_POS_X, y: CONSTANTS.SCORE_POS_Y, style: "fill: white"});
        canvas.appendChild(score);
        return score;
      }

      // create high score view on HTML
      function createHighScoreView(){
        const highScore = document.createElementNS(canvas.namespaceURI, "text");
        attr(highScore, {id: "highScore", x: CONSTANTS.SCORE_POS_X, y: CONSTANTS.HIGH_SCORE_POS_Y, style: "fill: white"});
        canvas.appendChild(highScore);
        return highScore;
      }

      // create level view on HTML
      function createLevelView(){
        const levels = document.createElementNS(canvas.namespaceURI, "text");
        attr(levels, {id: "levels", x: CONSTANTS.LEVEL_POS_X, y: CONSTANTS.LEVEL_POS_Y, style: "fill: white"});
        canvas.appendChild(levels);
        return levels;
      }

      const score = document.getElementById("score") || createScoreView(),
        highScore = document.getElementById("highScore") || createHighScoreView(),
        levels = document.getElementById("levels") || createLevelView();

      score.textContent = "Score: " + s.score;
      highScore.textContent = "High Score: " + s.highScore;
      levels.textContent = "Level: " + s.level;
    }
    
    updateScoreLevelView();
  }
  
  /* 
  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
      Main Game Stream 
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
  */
  merge(restart$, up$, down$, left$, right$, tick$).pipe(scan(reduceState, initialState)).subscribe(updateView);
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
