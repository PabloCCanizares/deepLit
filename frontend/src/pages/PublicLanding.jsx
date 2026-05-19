import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/public/PublicLanding.css'

const heroBadges = ['OpenAlex', 'Excel', 'PDFs', 'FAISS', 'RAG', 'LangGraph', 'SSE', 'MongoDB']

const problemCards = [
  {
    icon: 'fa-layer-group',
    title: 'Articulos en demasiados sitios',
    text: 'Buscas en OpenAlex, guardas PDFs, usas Excel y tomas notas, pero todo queda separado.',
  },
  {
    icon: 'fa-comment-dots',
    title: 'Preguntas sin contexto',
    text: 'Un chat puede contestar una duda, pero no sabe que articulos forman parte de tu revision.',
  },
  {
    icon: 'fa-magnifying-glass-chart',
    title: 'Informacion que se pierde',
    text: 'Lo importante de cada paper cuesta encontrarlo de nuevo cuando toca comparar y escribir.',
  },
  {
    icon: 'fa-clipboard-check',
    title: 'Resultados dificiles de revisar',
    text: 'Las decisiones y extracciones necesitan quedar guardadas con una explicacion clara.',
  },
]

const workflowSteps = [
  {
    number: '01',
    title: 'Anade articulos',
    text: 'Busca en OpenAlex, importa un Excel o sube tus propios PDFs.',
  },
  {
    number: '02',
    title: 'Elige una coleccion',
    text: 'Marca que grupo de articulos quieres analizar en ese momento.',
  },
  {
    number: '03',
    title: 'Prepara los documentos',
    text: 'DeepLIT extrae texto y prepara los PDFs para poder buscar dentro de ellos.',
  },
  {
    number: '04',
    title: 'Pregunta con contexto',
    text: 'El asistente responde usando la coleccion activa, no una pregunta aislada.',
  },
  {
    number: '05',
    title: 'Revisa los resultados',
    text: 'Obtiene cribado, evidencias, sintesis y borradores que puedes corregir.',
  },
]

const capabilityGroups = [
  {
    icon: 'fa-box-archive',
    title: 'Entrada de articulos',
    items: ['Busqueda en OpenAlex', 'Importacion desde Excel', 'Subida de PDFs', 'Biblioteca personal', 'Colecciones de trabajo'],
  },
  {
    icon: 'fa-vector-square',
    title: 'Preguntas con contexto',
    items: ['Texto procesado', 'Embeddings', 'Indices FAISS', 'RAG sobre la coleccion', 'Uso de metadatos si falta texto completo'],
  },
  {
    icon: 'fa-list-check',
    title: 'Revision de articulos',
    items: ['Cribado con criterios', 'Decisiones include/review/exclude', 'Fichas de evidencia', 'Fragmentos de apoyo', 'Agrupacion de trabajos'],
  },
  {
    icon: 'fa-pen-nib',
    title: 'Sintesis y redaccion',
    items: ['Resumen de la coleccion', 'Comparacion entre articulos', 'Vacios y limitaciones', 'Redaccion asistida', 'Borradores editables'],
  },
]

const chatDifferentiators = [
  'Trabaja sobre una coleccion concreta de articulos.',
  'Busca en PDFs procesados o en metadatos disponibles.',
  'Usa modulos distintos para preguntar, cribar, extraer y sintetizar.',
  'Guarda resultados para poder volver a revisarlos.',
  'Deja la decision final en manos del investigador.',
]

const traceabilityItems = [
  {
    title: 'Origen del contexto',
    text: 'Indica si la respuesta se apoya en texto completo o en metadatos, segun lo que el modulo admita.',
  },
  {
    title: 'Fragmentos de apoyo',
    text: 'Las extracciones pueden incluir fragmentos del articulo para revisar de donde salen.',
  },
  {
    title: 'Pendiente de revision',
    text: 'Si la evidencia no es clara, el sistema puede marcar el caso como review.',
  },
  {
    title: 'Historial de ejecuciones',
    text: 'Los resultados de cribado, evidencia y sintesis se pueden consultar despues.',
  },
  {
    title: 'Texto editable',
    text: 'Los borradores son una base para revisar y mejorar, no un resultado final automatico.',
  },
]

const architectureStages = [
  { label: 'Entradas', title: 'OpenAlex / Excel / PDF', text: 'Formas de traer articulos al sistema.' },
  { label: 'Biblioteca', title: 'Articulos guardados', text: 'Un lugar comun para consultar y organizar papers.' },
  { label: 'Contexto', title: 'Coleccion activa', text: 'El grupo de articulos sobre el que trabaja la IA.' },
  { label: 'Preparacion', title: 'Texto + embeddings', text: 'Documentos listos para busqueda semantica.' },
  { label: 'Consulta', title: 'FAISS + RAG', text: 'Recuperacion de contexto antes de responder.' },
  { label: 'Salida', title: 'Resultados revisables', text: 'Cribado, evidencia, sintesis y borrador.' },
]

const moduleCards = [
  ['fa-graduation-cap', 'OpenAlex search', 'Encuentra trabajos cientificos y guardalos en tu biblioteca.'],
  ['fa-file-import', 'Excel import', 'Importa articulos que ya tienes organizados en una hoja de calculo.'],
  ['fa-file-pdf', 'PDF pipeline', 'Prepara los PDFs para que DeepLIT pueda buscar dentro de ellos.'],
  ['fa-folder-tree', 'Colecciones', 'Agrupa articulos por tema, trabajo o pregunta de investigacion.'],
  ['fa-comments', 'Asistente RAG', 'Pregunta sobre una coleccion usando informacion de tus documentos.'],
  ['fa-filter', 'Cribado', 'Aplica criterios y clasifica articulos como include, review o exclude.'],
  ['fa-microscope', 'Evidence extraction', 'Extrae objetivos, metodo, datos, hallazgos y limitaciones.'],
  ['fa-object-group', 'Clustering', 'Agrupa trabajos parecidos para explorar temas dentro del corpus.'],
  ['fa-diagram-project', 'Collection synthesis', 'Resume acuerdos, diferencias y vacios de una coleccion.'],
  ['fa-pen-nib', 'Paper writer', 'Convierte ideas y sintesis en un borrador que puedes editar.'],
]

const useCases = [
  ['TFG y trabajos academicos', 'Reune los articulos de tu proyecto y entiende mejor que aporta cada uno.'],
  ['Exploracion de un tema', 'Crea una coleccion inicial y detecta ideas, enfoques y posibles lineas de trabajo.'],
  ['Revision preliminar', 'Filtra articulos, extrae evidencias y compara resultados antes de escribir.'],
  ['Redaccion asistida', 'Parte de una sintesis y prepara un borrador que puedas revisar con calma.'],
]

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="landingSectionHeading">
      <span className="landingKicker">{eyebrow}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  )
}

function ProductPreview() {
  return (
    <div className="landingProductPreview" aria-label="Vista conceptual de DeepLIT">
      <div className="landingPreviewTopbar">
        <span></span>
        <span></span>
        <span></span>
        <strong>Coleccion activa</strong>
      </div>

      <div className="landingPreviewBody">
        <aside className="landingPreviewRail" aria-label="Modulos principales">
          <span className="active">Dashboard</span>
          <span>Biblioteca</span>
          <span>Revision asistida</span>
          <span>OpenAlex</span>
        </aside>

        <div className="landingPreviewCanvas">
          <div className="landingPreviewHeader">
            <div>
              <span>Coleccion de trabajo</span>
              <h3>Preguntas y resultados sobre tus articulos</h3>
            </div>
            <strong>42 articulos</strong>
          </div>

          <div className="landingPreviewGrid">
            <section className="landingPreviewPanel libraryPanel">
              <div className="landingPanelTitle">
                <i className="fas fa-book-open" aria-hidden="true"></i>
                Biblioteca procesada
              </div>
              <div className="paperLine fullText">
                <span></span>
                <div>
                  <strong>Revision de literatura asistida por IA</strong>
                  <small>PDF procesado - texto completo disponible</small>
                </div>
              </div>
              <div className="paperLine indexed">
                <span></span>
                <div>
                  <strong>Recuperacion de informacion en articulos</strong>
                  <small>Documento preparado para busqueda semantica</small>
                </div>
              </div>
              <div className="paperLine metadata">
                <span></span>
                <div>
                  <strong>Evolucion de temas en OpenAlex</strong>
                  <small>Informacion disponible por metadatos</small>
                </div>
              </div>
            </section>

            <section className="landingPreviewPanel">
              <div className="landingPanelTitle">
                <i className="fas fa-comments" aria-hidden="true"></i>
                Pregunta con contexto
              </div>
              <p className="ragQuestion">"Que limitaciones se repiten en estos articulos?"</p>
              <div className="ragSnippet">
                <span>Fragmento de apoyo</span>
                <p>Varios trabajos mencionan muestras pequenas, sesgos de seleccion y poca evaluacion a largo plazo...</p>
              </div>
            </section>

            <section className="landingPreviewPanel decisionPanel">
              <div className="landingPanelTitle">
                <i className="fas fa-list-check" aria-hidden="true"></i>
                Cribado
              </div>
              <div className="decisionLine include">
                <span>include</span>
                <strong>12</strong>
              </div>
              <div className="decisionLine review">
                <span>review</span>
                <strong>7</strong>
              </div>
              <div className="decisionLine exclude">
                <span>exclude</span>
                <strong>23</strong>
              </div>
            </section>

            <section className="landingPreviewPanel artifactPanel">
              <div className="landingPanelTitle">
                <i className="fas fa-pen-nib" aria-hidden="true"></i>
                Borrador editable
              </div>
              <div className="draftBars" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function PublicLanding() {
  const { isAuthenticated } = useAuth()
  const primaryPath = isAuthenticated ? '/dashboard' : '/login'
  const primaryLabel = isAuthenticated ? 'Ir a mi espacio' : 'Entrar en DeepLIT'
  const secondaryPath = isAuthenticated ? '/review-workflow' : '/register'
  const secondaryLabel = isAuthenticated ? 'Abrir revision asistida' : 'Crear cuenta'

  return (
    <div className="landingPage">
      <header className="landingHeader">
        <Link to="/preview" className="landingBrand" aria-label="DeepLIT inicio">
          <span className="deepLit-d">deep</span>
          <span className="deepLit-lit">Lit</span>
        </Link>

        <nav className="landingNav" aria-label="Navegacion principal">
          <a href="#flujo">Flujo</a>
          <a href="#capacidades">Capacidades</a>
          <a href="#arquitectura">Arquitectura</a>
          <a href="#evidencia">Evidencia</a>
          <a href="#aplicacion">Aplicacion</a>
        </nav>

        <div className="landingHeaderActions">
          {!isAuthenticated && (
            <Link to="/register" className="landingButton ghost">
              Crear cuenta
            </Link>
          )}
          <Link to={primaryPath} className="landingButton primary">
            {primaryLabel}
          </Link>
        </div>
      </header>

      <main>
        <section className="landingHero" id="inicio">
          <div className="landingHeroCopy">
            <span className="landingKicker">DeepLIT - Revision cientifica asistida por IA</span>
            <h1>Organiza tus articulos y convierte la lectura en evidencia revisable.</h1>
            <p>
              DeepLIT te ayuda a guardar papers, trabajar con una coleccion concreta, hacer preguntas con contexto,
              extraer informacion importante y preparar sintesis o borradores que siempre puedes revisar.
            </p>

            <div className="landingHeroActions">
              <Link to={primaryPath} className="landingButton primary large">
                {primaryLabel}
                <i className="fas fa-arrow-right" aria-hidden="true"></i>
              </Link>
              <a href="#flujo" className="landingButton secondary large">
                Ver flujo de trabajo
              </a>
            </div>

            <ul className="landingBadges" aria-label="Tecnologias y conceptos de DeepLIT">
              {heroBadges.map((badge) => (
                <li key={badge}>{badge}</li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </section>

        <section className="landingSection" id="problema">
          <SectionHeading
            eyebrow="El problema"
            title="Encontrar papers es facil. Entenderlos y ordenarlos lleva mucho mas trabajo."
          >
            En una revision, el reto no es solo acumular articulos. Lo dificil es saber que dice cada uno, compararlos
            bien y no perder la evidencia cuando llega el momento de escribir.
          </SectionHeading>

          <div className="landingGrid four">
            {problemCards.map((card) => (
              <article className="landingCard compact" key={card.title}>
                <i className={`fas ${card.icon}`} aria-hidden="true"></i>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSection landingBand" id="flujo">
          <SectionHeading eyebrow="Flujo de trabajo" title="Un camino claro desde los articulos hasta la sintesis.">
            Primero incorporas articulos. Despues eliges una coleccion. A partir de ahi, DeepLIT puede ayudarte a
            preguntar, revisar, extraer evidencia y redactar con mas orden.
          </SectionHeading>

          <div className="workflowGrid">
            {workflowSteps.map((step) => (
              <article className="workflowCard" key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSection" id="capacidades">
          <SectionHeading eyebrow="Capacidades" title="Todo parte de la misma coleccion de articulos.">
            Las funciones de DeepLIT comparten biblioteca y coleccion activa. Asi evitas saltar entre herramientas sin
            saber que contexto esta usando cada respuesta.
          </SectionHeading>

          <div className="landingGrid four">
            {capabilityGroups.map((group) => (
              <article className="landingCard capabilityCard" key={group.title}>
                <div className="cardIcon">
                  <i className={`fas ${group.icon}`} aria-hidden="true"></i>
                </div>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSplitSection">
          <div>
            <span className="landingKicker">No es solo un chat</span>
            <h2>DeepLIT no empieza en una pregunta. Empieza en tus articulos.</h2>
            <p>
              La diferencia esta en el contexto. DeepLIT sabe sobre que coleccion estas trabajando y guarda resultados
              que puedes consultar, corregir y reutilizar.
            </p>
          </div>

          <div className="chatPanel">
            {chatDifferentiators.map((item) => (
              <div className="chatPoint" key={item}>
                <i className="fas fa-check" aria-hidden="true"></i>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="landingSection" id="evidencia">
          <SectionHeading eyebrow="Revision" title="La IA ayuda, pero la revision final sigue siendo tuya.">
            DeepLIT no presenta sus respuestas como verdades automaticas. Te muestra el contexto disponible, guarda los
            resultados y facilita que puedas comprobarlos antes de usarlos.
          </SectionHeading>

          <div className="traceabilityLayout">
            <article className="traceabilityRun">
              <div className="runHeader">
                <span>Run de evidencia</span>
                <strong>source_type: mixed</strong>
              </div>
              <div className="runBody">
                <p>
                  Decision: <strong>review</strong>
                </p>
                <p>
                  Apoyo recuperado desde PDF procesado y metadatos. Conviene revisarlo manualmente antes de usarlo como
                  evidencia final.
                </p>
              </div>
            </article>

            <div className="landingGrid traceabilityGrid">
              {traceabilityItems.map((item) => (
                <article className="landingCard compact" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landingSection landingBand" id="arquitectura">
          <SectionHeading eyebrow="Arquitectura tecnica" title="La parte tecnica esta al servicio del flujo de revision.">
            La aplicacion conecta frontend, API, base de datos, PDFs, busqueda semantica y RAG para que tus documentos
            puedan convertirse en resultados revisables.
          </SectionHeading>

          <div className="architectureGrid" aria-label="Pipeline tecnico de DeepLIT">
            {architectureStages.map((stage) => (
              <article className="architectureNode" key={stage.label}>
                <span>{stage.label}</span>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSection">
          <SectionHeading eyebrow="Modulos" title="Herramientas pensadas para trabajar con literatura cientifica.">
            Cada modulo resuelve una parte concreta del trabajo: encontrar, organizar, preguntar, revisar, sintetizar y
            redactar.
          </SectionHeading>

          <div className="moduleGrid">
            {moduleCards.map(([icon, title, text]) => (
              <article className="moduleCard" key={title}>
                <i className={`fas ${icon}`} aria-hidden="true"></i>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingSection">
          <SectionHeading eyebrow="Casos de uso" title="Util cuando tienes muchos articulos y necesitas avanzar con orden.">
            DeepLIT encaja en TFGs, revisiones de literatura, exploracion de temas nuevos y analisis de colecciones que
            ya tienes acumuladas.
          </SectionHeading>

          <div className="landingGrid four">
            {useCases.map(([title, text]) => (
              <article className="landingCard compact" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landingFinalCta" id="aplicacion">
          <div>
            <span className="landingKicker">Aplicacion</span>
            <h2>Empieza con tus articulos. Avanza con evidencia que puedes revisar.</h2>
            <p>Construye una coleccion, procesa documentos y usa IA conectada a tu propio material cientifico.</p>
          </div>
          <div className="landingHeroActions">
            <Link to={primaryPath} className="landingButton primary large">
              {primaryLabel}
            </Link>
            <Link to={secondaryPath} className="landingButton secondary large">
              {secondaryLabel}
            </Link>
          </div>
        </section>
      </main>

      <footer className="landingFooter">
        <div>
          <strong>DeepLIT</strong>
          <p>Proyecto de Ingenieria de Datos e Inteligencia Artificial para trabajar con literatura cientifica.</p>
        </div>
        <nav aria-label="Enlaces del pie de pagina">
          <a href="#flujo">Flujo</a>
          <a href="#capacidades">Capacidades</a>
          <a href="#arquitectura">Arquitectura</a>
          <a href="#evidencia">Evidencia</a>
          <Link to={primaryPath}>{primaryLabel}</Link>
        </nav>
      </footer>
    </div>
  )
}

export default PublicLanding
