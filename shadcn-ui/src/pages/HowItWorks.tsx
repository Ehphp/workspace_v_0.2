import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const quickActions = [
  { title: 'Stima rapida', desc: 'Descrizione + stack e ottieni subito giorni stimati', cta: 'Prova la stima rapida', state: { openQuick: true } },
  { title: 'Wizard avanzato', desc: 'Configura attivita, driver e rischi in 5 step', cta: 'Apri il wizard avanzato', state: { openWizard: true } },
];

const freeBullets = [
  'Stima rapida con descrizione e stack',
  'Attivita suggerite dall AI',
  'Puoi esportare o condividere la stima demo',
];

const pillars = [
  { title: 'Velocita', desc: 'Stima iniziale in pochi minuti con input minimi', badge: 'Fast' },
  { title: 'Trasparenza', desc: 'Formula visibile e breakdown per attivita e driver', badge: 'Clear' },
  { title: 'Flessibilita', desc: 'Passa dal quick al wizard completo quando serve', badge: 'Flexible' },
];

const steps = [
  { num: '01', title: 'Descrivi il requisito', desc: 'Scrivi cosa deve fare il progetto' },
  { num: '02', title: 'Scegli lo stack', desc: 'Seleziona il preset tecnologico piu vicino' },
  { num: '03', title: 'Ottieni la stima', desc: 'AI propone attivita e calcola i giorni' },
];

const registered = [
  'Salva liste e requisiti',
  'Personalizza driver e rischi per progetto',
  'Cronologia e condivisione con il team',
];

const faqs = [
  { q: 'I dati sono salvati?', a: 'No nel quick; si se sei registrato e salvi la lista.' },
  { q: 'Serve carta di credito?', a: 'No, prova subito. L account sblocca salvataggio e wizard completo.' },
  { q: 'Posso cambiare le attivita?', a: 'Si nel wizard avanzato; la stima rapida usa preset e AI.' },
  { q: 'Come gestite i rischi?', a: 'Il quick li ignora. Nel wizard puoi aggiungerli e vedere l impatto.' },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/40 backdrop-blur bg-white/80">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Requirements Estimator
              </p>
              <p className="text-xs text-slate-500 leading-none">Guida rapida</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="hover:bg-blue-50 hover:text-blue-700">
                Torna alla home
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow">
                Registrati
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-10 items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-200">
              Come funziona
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              Capisci in pochi minuti cosa fa lo strumento e quando usare il wizard avanzato
            </h1>
            <p className="text-lg text-slate-600">
              Stima rapida con AI e preset tecnologici, poi personalizza driver e rischi nel percorso guidato a 5 step.
              Tutto accessibile anche da non registrato.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/" state={{ openQuick: true }}>
                <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
                  Prova la stima rapida
                </Button>
              </Link>
              <Link to="/" state={{ openWizard: true }}>
                <Button size="lg" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  Apri il wizard avanzato
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-white/60">
                  Accedi o crea un account
                </Button>
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {quickActions.map((item) => (
                <Card key={item.title} className="border-slate-200/70 bg-white/70 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription className="text-slate-600">{item.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to="/" state={item.state}>
                      <Button variant="ghost" className="text-blue-700 hover:bg-blue-50 p-0">
                        {item.cta} →
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-slate-200/70 bg-white/80 backdrop-blur shadow-lg">
            <CardHeader>
              <CardTitle>Cosa puoi fare subito (senza registrarti)</CardTitle>
              <CardDescription>Zero barriere: provi e vedi il breakdown prima di creare account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {freeBullets.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
                Demo mode automatico se i dati non sono disponibili: puoi comunque ottenere una stima realistica.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 grid lg:grid-cols-3 gap-6">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="border-slate-200/70 bg-white/80 backdrop-blur hover:shadow-lg transition">
              <CardHeader className="space-y-2">
                <Badge variant="secondary" className="w-fit bg-slate-900 text-white">{pillar.badge}</Badge>
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription className="text-slate-600">{pillar.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-14 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <Card className="border-slate-200/70 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Come funziona (3 step rapidi)</CardTitle>
              <CardDescription>Per personalizzare driver e rischi passa al wizard completo in 5 step.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              {steps.map((step) => (
                <div key={step.num} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
                  <p className="text-xs font-semibold text-blue-700">{step.num}</p>
                  <p className="text-base font-semibold mt-1">{step.title}</p>
                  <p className="text-sm text-slate-600 mt-2">{step.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200/70 bg-gradient-to-br from-blue-50 via-white to-emerald-50 backdrop-blur shadow">
            <CardHeader>
              <CardTitle>Esempio rapido</CardTitle>
              <CardDescription>Portale utenti con login e reset password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Attivita AI: Auth + UI + Email reset</Badge>
                <Badge variant="secondary">Totale: 12.5 gg</Badge>
                <Badge variant="secondary">Stack: React + Node</Badge>
              </div>
              <p>
                Scrivi il requisito, scegli il preset React + Node e il sistema propone attivita e calcola i giorni.
                Per aggiungere rischi o driver di complessita passa al wizard avanzato.
              </p>
              <div className="flex gap-3 pt-2">
                <Link to="/" state={{ openQuick: true }}>
                  <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                    Rifai questa stima
                  </Button>
                </Link>
                <Link to="/" state={{ openWizard: true }}>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                    Apri il wizard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-14 grid lg:grid-cols-2 gap-8">
          <Card className="border-slate-200/70 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Cosa sblocchi da registrato</CardTitle>
              <CardDescription>Quando hai bisogno di salvare, riusare o condividere.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-slate-700">
              {registered.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-emerald-500 mt-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p>{item}</p>
                </div>
              ))}
              <div className="pt-4">
                <Link to="/register">
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                    Crea account gratis
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>FAQ rapide</CardTitle>
              <CardDescription>Le domande che arrivano piu spesso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.map((item) => (
                <div key={item.q} className="border-b last:border-b-0 border-slate-100 pb-3 last:pb-0">
                  <p className="font-semibold text-slate-900">{item.q}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-14 p-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Pronto a provare?</p>
            <h2 className="text-2xl font-bold">Scegli se partire veloce o entrare nel wizard completo</h2>
            <p className="text-sm text-slate-600 mt-1">Puoi tornare qui in ogni momento dall header.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/" state={{ openQuick: true }}>
              <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                Stima rapida
              </Button>
            </Link>
            <Link to="/" state={{ openWizard: true }}>
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                Wizard avanzato
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
