const { getLang } = require("./i18n");

const translations = {
  "punta-cana-villas": {
    en: {
      title: "Punta Cana Villas Revenue Share",
      type: "Short-stay tourism rental",
      legal_structure: "Real estate trust with economic rights linked to net operating income.",
      description: "A professionally operated portfolio of tourism villas with quarterly distributions based on net short-stay rental cash flow.",
      risk_level: "Medium"
    },
    de: {
      title: "Punta Cana Villas Umsatzbeteiligung",
      type: "Touristische Kurzzeitvermietung",
      legal_structure: "Immobilientreuhand mit wirtschaftlichen Rechten am Netto-Betriebsergebnis.",
      description: "Professionell betriebenes Portfolio touristischer Villen mit vierteljaehrlichen Ausschuettungen aus Netto-Cashflow der Kurzzeitvermietung.",
      risk_level: "Mittel"
    },
    fr: {
      title: "Punta Cana Villas Partage de revenus",
      type: "Location touristique courte duree",
      legal_structure: "Fiducie immobiliere avec droits economiques lies au revenu operationnel net.",
      description: "Portefeuille de villas touristiques operees professionnellement, avec distributions trimestrielles basees sur le flux net de location courte duree.",
      risk_level: "Moyen"
    }
  },
  "santo-domingo-torre": {
    en: {
      title: "Piantini Tower Presale",
      type: "Urban residential development",
      legal_structure: "Project SPV with contractual economic participation.",
      description: "Development capital for a premium residential tower with projected exit through unit sales and refinancing.",
      risk_level: "High"
    },
    de: {
      title: "Piantini Tower Vorverkauf",
      type: "Urbanes Wohnbauprojekt",
      legal_structure: "Projekt-SPV mit vertraglicher wirtschaftlicher Beteiligung.",
      description: "Entwicklungskapital fuer einen Premium-Wohnturm mit geplantem Exit ueber Wohnungsverkaeufe und Refinanzierung.",
      risk_level: "Hoch"
    },
    fr: {
      title: "Tour Piantini Prevente",
      type: "Developpement residentiel urbain",
      legal_structure: "SPV de projet avec participation economique contractuelle.",
      description: "Capital de developpement pour une tour residentielle premium avec sortie projetee par vente d'unites et refinancement.",
      risk_level: "Eleve"
    }
  },
  "samana-eco-hotel": {
    en: {
      title: "Samana Eco Hotel Notes",
      type: "Real estate debt",
      legal_structure: "Private note backed by project contracts and guarantees.",
      description: "Bridge financing for a sustainable hotel with semiannual interest payments and a 30-month maturity.",
      risk_level: "Medium"
    },
    de: {
      title: "Samana Eco Hotel Schuldverschreibungen",
      type: "Immobiliendarlehen",
      legal_structure: "Private Schuldverschreibung, besichert durch Projektvertraege und Garantien.",
      description: "Brueckenfinanzierung fuer ein nachhaltiges Hotel mit halbjaehrlichen Zinszahlungen und 30 Monaten Laufzeit.",
      risk_level: "Mittel"
    },
    fr: {
      title: "Samana Eco Hotel Notes",
      type: "Dette immobiliere",
      legal_structure: "Note privee adossee aux contrats et garanties du projet.",
      description: "Financement relais pour un hotel durable avec paiements d'interets semestriels et maturite de 30 mois.",
      risk_level: "Moyen"
    }
  },
  "finca-cacao-bayaguana": {
    en: {
      title: "Bayaguana Cacao Farm",
      type: "Agricultural cacao project",
      legal_structure: "Private project vehicle with economic rights over production, agricultural improvements, and documented operating cash flow.",
      description: "Seed capital project for a cacao farm in Bayaguana focused on productive improvements, farm maintenance, harvest preparation, and operating formalization. The test offering seeks to raise USD 10,000.",
      risk_level: "Medium"
    },
    de: {
      title: "Kakaofarm Bayaguana",
      type: "Landwirtschaftliches Kakaoprojekt",
      legal_structure: "Privates Projektvehikel mit wirtschaftlichen Rechten an Produktion, landwirtschaftlichen Verbesserungen und dokumentiertem operativem Cashflow.",
      description: "Startkapitalprojekt fuer eine Kakaofarm in Bayaguana, fokussiert auf Produktivitaetsverbesserungen, Wartung, Erntevorbereitung und operative Formalisierung. Das Testangebot zielt auf USD 10.000.",
      risk_level: "Mittel"
    },
    fr: {
      title: "Ferme de cacao Bayaguana",
      type: "Projet agricole cacao",
      legal_structure: "Vehicule prive de projet avec droits economiques sur la production, les ameliorations agricoles et le flux operationnel documente.",
      description: "Projet de capital initial pour une ferme de cacao a Bayaguana, axe sur les ameliorations productives, l'entretien agricole, la preparation de recolte et la formalisation operationnelle. L'offre test vise USD 10 000.",
      risk_level: "Moyen"
    }
  },
  "lionel-the-star-entertainment": {
    en: {
      title: "Lionel The Star Entertainment",
      type: "Music / bachata / merengue / live events",
      legal_structure: "Private economic participation agreement over net profits of the artistic project, subject to final contracts, periodic reporting, and revenue controls.",
      description: "Lionel The Star seeks to raise USD 10,000 to accelerate commercialization of an initial catalog of 14 original bachata and merengue songs, existing music videos, digital presence, events, tourism, streaming, YouTube, sponsorship, merchandising, and licensing.",
      risk_level: "High"
    },
    de: {
      title: "Lionel The Star Entertainment",
      type: "Musik / Bachata / Merengue / Live-Events",
      legal_structure: "Private wirtschaftliche Beteiligung an Nettogewinnen des Kuenstlerprojekts, vorbehaltlich finaler Vertraege, periodischer Berichte und Umsatzkontrollen.",
      description: "Lionel The Star moechte USD 10.000 aufnehmen, um die Vermarktung eines Katalogs mit 14 originalen Bachata- und Merengue-Songs, Musikvideos, digitaler Praesenz, Events, Tourismus, Streaming, YouTube, Sponsoring, Merchandising und Lizenzen zu beschleunigen.",
      risk_level: "Hoch"
    },
    fr: {
      title: "Lionel The Star Entertainment",
      type: "Musique / bachata / merengue / concerts",
      legal_structure: "Accord prive de participation economique aux benefices nets du projet artistique, sous reserve de contrats finaux, rapports periodiques et controles des revenus.",
      description: "Lionel The Star cherche a lever USD 10 000 pour accelerer la commercialisation d'un catalogue initial de 14 chansons originales de bachata et merengue, videos musicales, presence digitale, evenements, tourisme, streaming, YouTube, sponsoring, merchandising et licences.",
      risk_level: "Eleve"
    }
  }
};

function localizeProject(project, req) {
  if (!project) return project;
  const lang = getLang(req || { query: {}, cookies: {} });
  if (lang === "es") return project;
  return { ...project, ...(translations[project.slug] || {})[lang] };
}

function localizeProjects(projects, req) {
  return projects.map((project) => localizeProject(project, req));
}

module.exports = { localizeProject, localizeProjects };
