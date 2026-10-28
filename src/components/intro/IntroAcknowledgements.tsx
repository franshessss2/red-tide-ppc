/** Agency credit requested by the project owner for the closing scene. */
export function IntroAcknowledgements() {
  return <section className="intro-acknowledgements" aria-label="Collaborators">
    <p className="intro-acknowledgements__label">In collaboration with</p>
    <div className="intro-acknowledgements__logos">
      <div className="intro-acknowledgements__logo">
        <img src="/media/acknowledgements/dict-philippines.png"
          alt="Department of Information and Communications Technology (DICT), Philippines"
          width="1400" height="692" loading="lazy" decoding="async" draggable={false} />
      </div>
      <div className="intro-acknowledgements__logo intro-acknowledgements__logo--bfar">
        <img src="/media/acknowledgements/bfar-horizontal.svg"
          alt="Bureau of Fisheries and Aquatic Resources (BFAR), Philippines"
          width="1800" height="900" loading="lazy" decoding="async" draggable={false} />
      </div>
    </div>
  </section>
}
