export const metadata = {
  title: 'Privacy Policy | WikiFarma',
  description: 'Informativa sulla privacy di WikiFarma.it',
};

export default function PrivacyPage() {
  return (
    <div className="privacy-content">
      <h1>Privacy Policy di WikiFarma.it</h1>
      <p>Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

      <p>
        Benvenuto su WikiFarma. La tua privacy è importante per noi: questa pagina descrive quali
        dati raccogliamo e come li utilizziamo.
      </p>

      <h3>Dati raccolti</h3>
      <p>
        Se accedi con il tuo account Google, raccogliamo il tuo indirizzo email per associare lo
        storico delle diagnosi virtuali al tuo account. Le richieste di diagnosi vengono salvate
        solo se hai effettuato l&apos;accesso e possono essere consultate esclusivamente da te
        nella pagina Profilo.
      </p>

      <h3>Google AdSense</h3>
      <p>
        Utilizziamo Google AdSense per mostrare annunci pubblicitari. Google può utilizzare cookie
        per personalizzare gli annunci in base alle tue visite precedenti su questo o altri siti.
        Puoi disattivare la pubblicità personalizzata visitando le{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
          impostazioni annunci di Google
        </a>
        .
      </p>

      <h3>Google Analytics</h3>
      <p>
        Utilizziamo Google Analytics (GA4) per analizzare in forma aggregata l&apos;utilizzo del
        sito e migliorare i nostri contenuti.
      </p>

      <h3>Diagnosi AI</h3>
      <p>
        Le risposte generate dallo strumento di Diagnosi Virtuale sono prodotte da un modello di
        intelligenza artificiale e non costituiscono in alcun modo una diagnosi medica. Non
        sostituiscono il parere di un medico. In caso di emergenza, contatta immediatamente il
        numero 112.
      </p>

      <h3>Contatti</h3>
      <p>
        Per qualsiasi domanda relativa alla privacy scrivi a{' '}
        <a href="mailto:privacy@wikifarma.it">privacy@wikifarma.it</a>.
      </p>
    </div>
  );
}
