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
    GameTickDuration: 100,
    FrogStartX: 100,
    FrogStartY: 100,

  } as const

  class Tick { constructor(public readonly elapsed:number) {} }
  class Move { constructor(public readonly axis: 'y'|'x', public readonly change: -10 | 10) {}}

  const keydown$ = fromEvent<KeyboardEvent>(document, "keydown");
  const up$ = keydown$.pipe(filter(e => String(e.key) == "w"), map(_ => new Move('y', -10)));
  const down$ = keydown$.pipe(filter(e => String(e.key) == "s"), map(_ => new Move('y', 10)));
  const left$ = keydown$.pipe(filter(e => String(e.key) == "a"), map(_ => new Move('x', -10)));
  const right$ = keydown$.pipe(filter(e => String(e.key) == "d"), map(_ => new Move('x', 10)));

  const keyboardmove$ = merge(up$, down$, left$, right$);

  const tick$ = interval(Constants.GameTickDuration).pipe(
    map(number => new Tick(number))
  );

  type Frog = Readonly<{
    id: string,
    x: number,
    y: number
  }>

  type State = Readonly<{
    frog: Frog,
  }>

  const initialState: State ={
    frog:{
      id: "frog",
      x: Constants.FrogStartX,
      y: Constants.FrogStartY
    }
  }

  const reduceState = (currentState: State, event: Move|Tick): State => {
    if (event instanceof Move){
      return {...currentState, frog: {
        ...currentState.frog, 
        x: event.axis === 'x' ? (currentState.frog.x + event.change) : currentState.frog.x,
        y: event.axis === 'y' ? (currentState.frog.y + event.change) : currentState.frog.y,
      }
    }
    } else {
      return currentState
    }
  }
  merge(keyboardmove$, tick$).pipe(scan(reduceState, initialState)).subscribe();

  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  // Example on adding an element
  const circle = document.createElementNS(svg.namespaceURI, "circle");
  circle.setAttribute("r", "10");
  circle.setAttribute("cx", "100");
  circle.setAttribute("cy", "100");
  circle.setAttribute(
    "style",
    "fill: green; stroke: green; stroke-width: 1px;"
  );
  svg.appendChild(circle);

  function updateView(s: State){
    const canvas = document.getElementById("svgCanvas")!;
    const frog = document.getElementById(s.frog.id);
    frog?.setAttribute("x", String(s.frog.x));
    frog?.setAttribute("y", String(s.frog.y));
  }

  merge(keyboardmove$, tick$).pipe(scan(reduceState, initialState)).subscribe(updateView);
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
