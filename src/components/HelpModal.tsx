import { useEffect, useRef } from 'preact/hooks';
import type { Lang } from '../lib/i18n';
import { pretty } from '../lib/generate';

interface Kind {
  title: string;
  what: string;
  how: string;
  examples: string[];
}

interface Content {
  title: string;
  intro: string;
  close: string;
  tryIt: string;
  sections: {
    typing: { title: string; rows: [string, string][] };
    kinds: { title: string; items: Kind[] };
    steps: { title: string; rows: [string, string][] };
    camera: { title: string; rows: [string, string][] };
    examples: { title: string; rows: string[] };
    colors: { title: string; rows: [string, string, string][] };
    trouble: { title: string; rows: [string, string][] };
  };
}

const KINDS_EN: Kind[] = [
  { title: 'Linear equations', what: 'One unknown x, no powers.', how: 'Balance scale with blocks: add or take away the same thing on both sides, cancel zero pairs, split into equal groups. Then check the answer and see it as two lines crossing.', examples: ['2x + 3 = 7', '3x - 4 = x + 6', '2(x - 1) = x + 4', 'x/2 + 1 = 4'] },
  { title: 'x² = number (or x³)', what: 'Only one power of x and numbers.', how: 'Isolate x² on the balance, then take the square root (± two answers) or cube root.', examples: ['x^2 = 9', '2x^2 = 50', 'x^3 = 8'] },
  { title: 'Quadratic equations', what: 'ax² + bx + c = 0.', how: 'Blocks are arranged into a rectangle whose sides are the factors; or "find two numbers"; or the quadratic formula with the discriminant Δ. Roots are shown on the parabola.', examples: ['x^2 + 5x + 6 = 0', 'x^2 - 5x + 6 = 0', 'x^2 + x - 1 = 0', 'x^2 + 1 = 0'] },
  { title: 'Cubic and higher', what: 'x³, x⁴…', how: 'Common factor (stacked into a 3D box), trying small numbers, dividing out factors, and reading any remaining roots from the graph.', examples: ['x^3 + 3x^2 = 0', 'x^3 + 5x^2 + 6x = 0', 'x^3 - 6x^2 + 11x - 6 = 0', 'x^4 - 5x^2 + 4 = 0'] },
  { title: 'Lines y = mx + b', what: 'A function of x.', how: 'Table of values, y-intercept, slope as rise/run arrows, drawing the line, and where it crosses the x-axis.', examples: ['y = x + 2', 'y = -2x + 3', 'y = (1/2)x - 1'] },
  { title: 'Parabolas and other functions', what: 'y = (anything with x).', how: 'Table of values, vertex and axis of symmetry, intercepts, roots. Also works with sqrt, sin, cos, abs…', examples: ['y = x^2 - 4x + 3', 'y = x^3 - x', 'y = sin(x)', 'x^2 - 4'] },
  { title: 'Equations with x and y', what: 'Like ax + by = c.', how: 'Isolate y with the balance, then graph it. Circles are recognised (centre and radius, completing the square); other curves are drawn point by point.', examples: ['2x + 3y = 6', 'x^2 + y^2 = 25', '(x - 1)^2 + (y + 2)^2 = 9'] },
  { title: 'Systems of equations', what: 'Up to 10 equations in x and y separated by ";".', how: 'Each one is graphed, then solved by substitution step by step (two circles are subtracted first). The final view shows every graph and all intersections; red points satisfy all the equations.', examples: ['x + 2 = y; 3x - 2y = 2', 'y = x^2 - 4; y = 2x - 1', 'x^2 + y^2 = 25; y = x + 1', 'y = x^2; y = 2 - x^2; y = x'] },
  { title: '3D surfaces', what: 'z = (something with x and y).', how: 'Slices at y = 0 and x = 0 are drawn first, then the whole surface rises out of the floor.', examples: ['z = x^2 - y^2', 'z = x^2 + y^2', 'z = sin(x) + cos(y)'] },
  { title: 'Hard equations', what: 'Mixing functions, e.g. sqrt(x) = 3 − x.', how: 'Each side is drawn as a graph; the solutions are where they meet, found numerically.', examples: ['sqrt(x) = 3 - x', 'sin(x) = x/2'] },
];

const KINDS_ES: Kind[] = [
  { title: 'Ecuaciones lineales', what: 'Una incógnita x, sin potencias.', how: 'Balanza con bloques: suma o resta lo mismo en ambos lados, cancela pares cero, reparte en grupos iguales. Después se comprueba y se ve como dos rectas que se cruzan.', examples: ['2x + 3 = 7', '3x - 4 = x + 6', '2(x - 1) = x + 4', 'x/2 + 1 = 4'] },
  { title: 'x² = número (o x³)', what: 'Solo una potencia de x y números.', how: 'Se despeja x² en la balanza y luego se saca raíz cuadrada (± dos respuestas) o raíz cúbica.', examples: ['x^2 = 9', '2x^2 = 50', 'x^3 = 8'] },
  { title: 'Ecuaciones cuadráticas', what: 'ax² + bx + c = 0.', how: 'Los bloques se acomodan en un rectángulo cuyos lados son los factores; o "busca dos números"; o la fórmula general con el discriminante Δ. Las raíces se ven en la parábola.', examples: ['x^2 + 5x + 6 = 0', 'x^2 - 5x + 6 = 0', 'x^2 + x - 1 = 0', 'x^2 + 1 = 0'] },
  { title: 'Cúbicas y de mayor grado', what: 'x³, x⁴…', how: 'Factor común (apilado en una caja 3D), probar números pequeños, dividir entre factores y leer las raíces restantes en la gráfica.', examples: ['x^3 + 3x^2 = 0', 'x^3 + 5x^2 + 6x = 0', 'x^3 - 6x^2 + 11x - 6 = 0', 'x^4 - 5x^2 + 4 = 0'] },
  { title: 'Rectas y = mx + b', what: 'Una función de x.', how: 'Tabla de valores, ordenada al origen, pendiente con flechas "sube/avanza", trazo de la recta y dónde cruza el eje x.', examples: ['y = x + 2', 'y = -2x + 3', 'y = (1/2)x - 1'] },
  { title: 'Parábolas y otras funciones', what: 'y = (cualquier cosa con x).', how: 'Tabla de valores, vértice y eje de simetría, cortes con los ejes, raíces. También funciona con sqrt, sin, cos, abs…', examples: ['y = x^2 - 4x + 3', 'y = x^3 - x', 'y = sin(x)', 'x^2 - 4'] },
  { title: 'Ecuaciones con x y y', what: 'Como ax + by = c.', how: 'Se despeja y con la balanza y luego se grafica. Las circunferencias se reconocen (centro y radio, completando el cuadrado); otras curvas se dibujan punto por punto.', examples: ['2x + 3y = 6', 'x^2 + y^2 = 25', '(x - 1)^2 + (y + 2)^2 = 9'] },
  { title: 'Sistemas de ecuaciones', what: 'Hasta 10 ecuaciones en x y y separadas por ";".', how: 'Cada una se grafica y luego se resuelve por sustitución paso a paso (dos circunferencias se restan primero). La vista final muestra todas las gráficas y sus intersecciones; los puntos rojos cumplen todas las ecuaciones.', examples: ['x + 2 = y; 3x - 2y = 2', 'y = x^2 - 4; y = 2x - 1', 'x^2 + y^2 = 25; y = x + 1', 'y = x^2; y = 2 - x^2; y = x'] },
  { title: 'Superficies 3D', what: 'z = (algo con x y y).', how: 'Primero se dibujan los cortes en y = 0 y x = 0, luego toda la superficie sale del piso.', examples: ['z = x^2 - y^2', 'z = x^2 + y^2', 'z = sin(x) + cos(y)'] },
  { title: 'Ecuaciones difíciles', what: 'Mezclan funciones, p. ej. sqrt(x) = 3 − x.', how: 'Cada lado se dibuja como gráfica; las soluciones están donde se cruzan, encontradas numéricamente.', examples: ['sqrt(x) = 3 - x', 'sin(x) = x/2'] },
];

const CONTENT: Record<Lang, Content> = {
  en: {
    title: 'How to use Algebra 3D',
    intro: 'Type an equation or a function, press Solve, and walk through the solution step by step. Every step has its own 3D scene you can move around in.',
    close: 'Close',
    tryIt: 'Try:',
    sections: {
      typing: {
        title: 'Typing math',
        rows: [
          ['2x, 3(x+1), x(x−2)', 'Multiplication can be written without ×'],
          ['x^2  or  x²', 'Powers: ^ or the ² ³ keys'],
          ['x/2, (1/3)x', 'Fractions; use brackets for fractional slopes'],
          ['sqrt(x), abs(x), sin, cos, tan, ln, log, exp, pi', 'Functions and constants'],
          ['x + 2 = y; 3x − 2y = 2', 'Several equations (a system): separate with ";" (up to 10)'],
          ['x^2 − 4', 'No "=" means y = that expression'],
          ['z = x^2 − y^2', 'z only for 3D surfaces'],
        ],
      },
      kinds: { title: 'Problems it can solve', items: KINDS_EN },
      steps: {
        title: 'Moving through the steps',
        rows: [
          ['◀ ▶ or ← →', 'Previous / next step'],
          ['Dots', 'Jump to any step'],
          ['⏵ Play or Space', 'Play the steps automatically'],
          ['Final view or End', 'Go straight to the answer'],
          ['⏮ Start or Home', 'Back to the beginning'],
        ],
      },
      camera: {
        title: 'Moving the camera (like a game)',
        rows: [
          ['Drag', 'Rotate around'],
          ['Right-drag', 'Pan'],
          ['Mouse wheel / pinch', 'Zoom'],
          ['W A S D', 'Walk forward / left / back / right'],
          ['Q E', 'Turn left / right'],
          ['R F', 'Up / down'],
          ['+ −', 'Zoom in / out'],
          ['🎯 Front Top Side', 'Camera presets (🎯 = the best view for this step)'],
          ['⟳', 'Spin around automatically'],
        ],
      },
      examples: {
        title: 'Examples and favorites',
        rows: [
          'The list on the left never ends: scroll down and new practice formulas are created for you.',
          'Click a formula to solve it.',
          'Click ☆ to pin it: it turns gold ★ and moves to Favorites at the top. Favorites are saved in this browser and appear first every time you come back.',
          'The ☆ next to the input box pins whatever you typed.',
          'On a phone, open the list with ☰ Examples.',
        ],
      },
      colors: {
        title: 'What the colours mean',
        rows: [
          ['#f2a93b', 'Orange cube', 'x³'],
          ['#3b82f6', 'Blue flat', 'x²'],
          ['#22c55e', 'Green rod', 'x'],
          ['#a855f7', 'Purple rod', 'y'],
          ['#facc15', 'Small yellow cube', '1'],
          ['#ef4444', 'Red block', 'negative (a red and a matching normal block cancel)'],
          ['#f43f5e', 'Red point', 'a solution / root'],
          ['#fbbf24', 'Yellow point', 'table value, or a crossing of only some equations'],
        ],
      },
      trouble: {
        title: 'If something goes wrong',
        rows: [
          ['"Unknown letter"', 'Only x, y (and z for surfaces) are allowed. Write functions in full: sqrt(x), not √ with nothing after it.'],
          ['"Use only one = sign"', 'For several equations separate them with ";" instead of writing two "=" on one line.'],
          ['"Too many )" / "Expected )"', 'Count your brackets: every "(" needs a ")".'],
          ['"no real solution"', 'Not an error: the graph never touches the x-axis (for example x² + 1 = 0).'],
          ['"no solution" in a system', 'The graphs never cross (for example parallel lines). "Infinitely many" means both equations are the same line.'],
          ['Answer shown as ≈', 'The exact answer is not a simple number, so it is rounded to 3 decimals.'],
          ['I lost the picture', 'Press 🎯 to bring the camera back to the best view for the step.'],
          ['Slow or blank 3D', 'The 3D needs WebGL. Close other tabs, or try another browser. On slow computers, wait a moment after the page loads before clicking.'],
          ['Favorites disappeared', 'They are saved in this browser only. Private windows or clearing site data removes them.'],
          ['Share an exercise', 'The address bar keeps your equation (?q=…). Add &lang=en or &lang=es to choose the language.'],
        ],
      },
    },
  },
  es: {
    title: 'Cómo usar Álgebra 3D',
    intro: 'Escribe una ecuación o una función, presiona Resolver y recorre la solución paso a paso. Cada paso tiene su propia escena 3D que puedes explorar.',
    close: 'Cerrar',
    tryIt: 'Prueba:',
    sections: {
      typing: {
        title: 'Cómo escribir',
        rows: [
          ['2x, 3(x+1), x(x−2)', 'La multiplicación se puede escribir sin ×'],
          ['x^2  o  x²', 'Potencias: ^ o las teclas ² ³'],
          ['x/2, (1/3)x', 'Fracciones; usa paréntesis para pendientes fraccionarias'],
          ['sqrt(x), abs(x), sin, cos, tan, ln, log, exp, pi', 'Funciones y constantes'],
          ['x + 2 = y; 3x − 2y = 2', 'Varias ecuaciones (un sistema): sepáralas con ";" (hasta 10)'],
          ['x^2 − 4', 'Sin "=" significa y = esa expresión'],
          ['z = x^2 − y^2', 'z solo para superficies 3D'],
        ],
      },
      kinds: { title: 'Problemas que puede resolver', items: KINDS_ES },
      steps: {
        title: 'Moverse entre los pasos',
        rows: [
          ['◀ ▶ o ← →', 'Paso anterior / siguiente'],
          ['Puntitos', 'Saltar a cualquier paso'],
          ['⏵ Reproducir o Espacio', 'Ver los pasos automáticamente'],
          ['Vista final o Fin', 'Ir directo a la respuesta'],
          ['⏮ Inicio', 'Volver al principio'],
        ],
      },
      camera: {
        title: 'Mover la cámara (como en un videojuego)',
        rows: [
          ['Arrastrar', 'Girar alrededor'],
          ['Clic derecho y arrastrar', 'Desplazar'],
          ['Rueda del ratón / pellizcar', 'Zoom'],
          ['W A S D', 'Caminar adelante / izquierda / atrás / derecha'],
          ['Q E', 'Voltear a la izquierda / derecha'],
          ['R F', 'Subir / bajar'],
          ['+ −', 'Acercar / alejar'],
          ['🎯 Frente Arriba Lado', 'Cámaras predefinidas (🎯 = la mejor vista de este paso)'],
          ['⟳', 'Girar automáticamente'],
        ],
      },
      examples: {
        title: 'Ejemplos y favoritas',
        rows: [
          'La lista de la izquierda nunca se acaba: baja y se crean nuevas fórmulas de práctica.',
          'Haz clic en una fórmula para resolverla.',
          'Haz clic en ☆ para fijarla: se vuelve dorada ★ y sube a Favoritas. Se guardan en este navegador y aparecen primero cada vez que regresas.',
          'La ☆ junto al cuadro de texto fija lo que escribiste.',
          'En el celular, abre la lista con ☰ Ejemplos.',
        ],
      },
      colors: {
        title: 'Qué significan los colores',
        rows: [
          ['#f2a93b', 'Cubo naranja', 'x³'],
          ['#3b82f6', 'Placa azul', 'x²'],
          ['#22c55e', 'Barra verde', 'x'],
          ['#a855f7', 'Barra morada', 'y'],
          ['#facc15', 'Cubito amarillo', '1'],
          ['#ef4444', 'Bloque rojo', 'negativo (un bloque rojo y su bloque normal se cancelan)'],
          ['#f43f5e', 'Punto rojo', 'una solución / raíz'],
          ['#fbbf24', 'Punto amarillo', 'valor de la tabla, o cruce de solo algunas ecuaciones'],
        ],
      },
      trouble: {
        title: 'Si algo sale mal',
        rows: [
          ['"Letra desconocida"', 'Solo se permiten x, y (y z para superficies). Escribe las funciones completas: sqrt(x).'],
          ['"Usa solo un signo ="', 'Para varias ecuaciones sepáralas con ";" en vez de poner dos "=" en una línea.'],
          ['"Sobran )" / "Falta )"', 'Cuenta tus paréntesis: cada "(" necesita su ")".'],
          ['"sin solución real"', 'No es un error: la gráfica nunca toca el eje x (por ejemplo x² + 1 = 0).'],
          ['"sin solución" en un sistema', 'Las gráficas nunca se cruzan (por ejemplo rectas paralelas). "Infinitas" significa que ambas ecuaciones son la misma recta.'],
          ['La respuesta sale con ≈', 'La respuesta exacta no es un número sencillo, así que se redondea a 3 decimales.'],
          ['Perdí la imagen', 'Presiona 🎯 para regresar la cámara a la mejor vista del paso.'],
          ['El 3D va lento o en blanco', 'El 3D necesita WebGL. Cierra otras pestañas o prueba otro navegador. En computadoras lentas, espera un momento después de cargar antes de hacer clic.'],
          ['Desaparecieron mis favoritas', 'Se guardan solo en este navegador. Las ventanas privadas o borrar los datos del sitio las eliminan.'],
          ['Compartir un ejercicio', 'La barra de direcciones guarda tu ecuación (?q=…). Agrega &lang=es o &lang=en para elegir el idioma.'],
        ],
      },
    },
  },
};

interface Props {
  lang: Lang;
  onClose: () => void;
  onTry: (q: string) => void;
}

export default function HelpModal({ lang, onClose, onTry }: Props) {
  const c = CONTENT[lang];
  const s = c.sections;
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Keep step/camera keys from acting behind the modal.
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  const table = (rows: [string, string][]) => (
    <dl class="help-table">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header class="modal-head">
          <h2 id="help-title">❔ {c.title}</h2>
          <button ref={closeBtn} class="modal-close" onClick={onClose} aria-label={c.close} title={c.close}>
            ✕
          </button>
        </header>
        <div class="modal-body">
          <p class="lead">{c.intro}</p>

          <section>
            <h3>⌨️ {s.typing.title}</h3>
            {table(s.typing.rows)}
          </section>

          <section>
            <h3>🧮 {s.kinds.title}</h3>
            <div class="kinds">
              {s.kinds.items.map((k) => (
                <article class="kind-card" key={k.title}>
                  <h4>{k.title}</h4>
                  <p class="what">{k.what}</p>
                  <p>{k.how}</p>
                  <div class="tries">
                    <span>{c.tryIt}</span>
                    {k.examples.map((q) => (
                      <button key={q} class="try" onClick={() => onTry(q)}>
                        {pretty(q)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div class="two-col">
            <section>
              <h3>👣 {s.steps.title}</h3>
              {table(s.steps.rows)}
            </section>
            <section>
              <h3>🎮 {s.camera.title}</h3>
              {table(s.camera.rows)}
            </section>
          </div>

          <div class="two-col">
            <section>
              <h3>⭐ {s.examples.title}</h3>
              <ul class="help-list">
                {s.examples.rows.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>🎨 {s.colors.title}</h3>
              <ul class="swatches">
                {s.colors.rows.map(([col, name, mean]) => (
                  <li key={name}>
                    <i style={`--c:${col}`} />
                    <b>{name}</b> {mean}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <h3>🛠️ {s.trouble.title}</h3>
            {table(s.trouble.rows)}
          </section>
        </div>
      </div>
    </div>
  );
}
