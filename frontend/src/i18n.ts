import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      brand: {
        homeLabel: 'WePush home',
        subtitle: 'Creator marketplace',
        demo: 'Demo workspace'
      },
      language: { label: 'Language', english: 'English', german: 'Deutsch' },
      mode: {
        label: 'Application mode',
        creator: 'Creator',
        admin: 'Live Admin'
      },
      creators: {
        eyebrow: 'Find your next collaboration',
        title: 'Choose a creator profile',
        intro:
          'This demo skips sign-in. Pick a profile to see campaigns matched by audience, genre, and engagement.',
        followers: 'followers',
        engagement: 'engagement',
        openProfile: 'Open {{name}}’s profile'
      },
      navigation: {
        switchCreator: '← Switch creator',
        matches: 'Matches',
        bids: 'My bids',
        workspace: 'Creator workspace'
      },
      matches: {
        eyebrow: 'Open opportunities',
        title: 'Campaigns that fit',
        count_one: '{{count}} match',
        count_other: '{{count}} matches',
        emptyTitle: 'No matches yet',
        emptyText: 'There are no eligible open campaigns for this profile.',
        fit: '{{score}}% fit',
        closes: 'Closes {{date}}',
        budget: 'budget',
        minimumFollowers: 'min. followers',
        targetEngagement: 'target engagement'
      },
      bidForm: {
        newLabel: 'Your bid',
        reviseLabel: 'Revise your bid',
        placeholder: '0.00',
        submit: 'Bid',
        update: 'Update',
        saving: 'Saving…',
        submitted: 'Bid submitted.',
        updated: 'Bid updated.',
        saveError: 'Could not save the bid.'
      },
      bids: {
        eyebrow: 'Your activity',
        title: 'Submitted bids',
        emptyTitle: 'No bids yet',
        emptyText: 'Choose a matched campaign and submit your first bid.',
        browse: 'Browse matches',
        updated: 'Updated {{date}}',
        fit: 'Fit {{score}}%'
      },
      status: {
        pending: 'Pending',
        accepted: 'Accepted',
        rejected: 'Rejected',
        won: 'Won',
        lost: 'Lost',
        open: 'Open',
        closed: 'Closed'
      },
      admin: {
        eyebrow: 'Marketplace operations',
        title: 'Live Admin',
        navigation: 'Admin navigation',
        overview: 'Overview',
        creators: 'Creators',
        newCampaign: 'New campaign',
        live: 'Live',
        reconnecting: 'Reconnecting',
        due: 'Due now',
        bids: 'bids',
        winners: 'winners',
        wins: 'wins',
        activeCreators: 'Active creators',
        openCampaigns: 'Open campaigns',
        pendingBids: 'Pending bids',
        closed24h: 'Closed in 24h',
        openBudget: 'open budget',
        campaignMonitor: 'Campaign monitor',
        processDue: 'Process due',
        processConfirm: 'Process all campaigns whose deadlines have passed?',
        processed: '{{count}} campaigns processed.',
        activity: 'Live activity',
        waitingEvents: 'Waiting for marketplace events…',
        rankedBids: 'Ranked bids',
        rank: 'Rank',
        creator: 'Creator',
        amount: 'Amount',
        fit: 'Fit',
        score: 'Score',
        status: 'Status',
        provisional: 'provisional',
        creatorRoster: 'Creator roster',
        search: 'Search creators',
        campaignTitle: 'Campaign title',
        description: 'Description',
        genre: 'Target genre',
        minimumFollowers: 'Minimum followers',
        targetEngagement: 'Target engagement %',
        deadline: 'Bidding deadline',
        asset: 'Asset',
        budget: 'Budget',
        createCampaign: 'Create campaign',
        noCampaignsTitle: 'No campaigns yet',
        noCampaignsText: 'Create a campaign to begin marketplace activity.',
        noBidsTitle: 'No bids yet',
        noBidsText: 'This campaign has not received any bids.',
        noCreatorsTitle: 'No creators found',
        noCreatorsText: 'No creator matches the current search.',
        events: {
          creator: { created: 'Creator joined' },
          campaign: { created: 'Campaign created', closed: 'Auction closed' },
          bid: {
            created: 'New bid received',
            updated: 'Bid revised',
            finalized: 'Bid finalized'
          }
        }
      },
      error: {
        title: 'We couldn’t load this page.',
        retry: 'Try again',
        generic: 'Something went wrong',
        codes: {
          invalid_request: 'Check the entered values and try again.',
          not_found: 'The requested item no longer exists.',
          invalid_input: 'Check the entered values and try again.',
          invalid_amount: 'Enter a valid amount for this asset.',
          ineligible_creator: 'This creator is not eligible for the campaign.',
          campaign_unavailable: 'This campaign is no longer open for bidding.',
          conflict: 'The change conflicts with existing data.',
          constraint_violation: 'The change violates a marketplace rule.',
          internal_error: 'The service could not complete the request.'
        }
      },
      loading: 'Loading',
      notFound: {
        title: 'This page went off-script.',
        action: 'Back to creators'
      }
    }
  },
  de: {
    translation: {
      brand: {
        homeLabel: 'WePush Startseite',
        subtitle: 'Creator-Marktplatz',
        demo: 'Demo-Arbeitsbereich'
      },
      language: { label: 'Sprache', english: 'English', german: 'Deutsch' },
      mode: {
        label: 'Anwendungsmodus',
        creator: 'Creator',
        admin: 'Live-Admin'
      },
      creators: {
        eyebrow: 'Finde deine nächste Kooperation',
        title: 'Wähle ein Creator-Profil',
        intro:
          'Diese Demo kommt ohne Anmeldung aus. Wähle ein Profil, um Kampagnen passend zu Zielgruppe, Genre und Interaktion zu sehen.',
        followers: 'Follower',
        engagement: 'Interaktion',
        openProfile: 'Profil von {{name}} öffnen'
      },
      navigation: {
        switchCreator: '← Creator wechseln',
        matches: 'Matches',
        bids: 'Meine Gebote',
        workspace: 'Creator-Arbeitsbereich'
      },
      matches: {
        eyebrow: 'Offene Möglichkeiten',
        title: 'Passende Kampagnen',
        count_one: '{{count}} Match',
        count_other: '{{count}} Matches',
        emptyTitle: 'Noch keine Matches',
        emptyText:
          'Für dieses Profil gibt es derzeit keine passenden offenen Kampagnen.',
        fit: '{{score}}% passend',
        closes: 'Endet {{date}}',
        budget: 'Budget',
        minimumFollowers: 'Min. Follower',
        targetEngagement: 'Zielinteraktion'
      },
      bidForm: {
        newLabel: 'Dein Gebot',
        reviseLabel: 'Gebot ändern',
        placeholder: '0,00',
        submit: 'Bieten',
        update: 'Ändern',
        saving: 'Speichern…',
        submitted: 'Gebot abgegeben.',
        updated: 'Gebot aktualisiert.',
        saveError: 'Das Gebot konnte nicht gespeichert werden.'
      },
      bids: {
        eyebrow: 'Deine Aktivitäten',
        title: 'Abgegebene Gebote',
        emptyTitle: 'Noch keine Gebote',
        emptyText: 'Wähle eine passende Kampagne und gib dein erstes Gebot ab.',
        browse: 'Matches ansehen',
        updated: 'Aktualisiert {{date}}',
        fit: 'Passung {{score}}%'
      },
      status: {
        pending: 'Offen',
        accepted: 'Angenommen',
        rejected: 'Abgelehnt',
        won: 'Gewonnen',
        lost: 'Verloren',
        open: 'Offen',
        closed: 'Geschlossen'
      },
      admin: {
        eyebrow: 'Marktplatzbetrieb',
        title: 'Live-Admin',
        navigation: 'Admin-Navigation',
        overview: 'Übersicht',
        creators: 'Creator',
        newCampaign: 'Neue Kampagne',
        live: 'Live',
        reconnecting: 'Verbindung wird hergestellt',
        due: 'Jetzt fällig',
        bids: 'Gebote',
        winners: 'Gewinner',
        wins: 'Siege',
        activeCreators: 'Aktive Creator',
        openCampaigns: 'Offene Kampagnen',
        pendingBids: 'Offene Gebote',
        closed24h: 'In 24 Std. geschlossen',
        openBudget: 'offenes Budget',
        campaignMonitor: 'Kampagnenmonitor',
        processDue: 'Fällige verarbeiten',
        processConfirm:
          'Alle Kampagnen verarbeiten, deren Frist abgelaufen ist?',
        processed: '{{count}} Kampagnen verarbeitet.',
        activity: 'Live-Aktivität',
        waitingEvents: 'Warte auf Marktplatzereignisse…',
        rankedBids: 'Rangliste der Gebote',
        rank: 'Rang',
        creator: 'Creator',
        amount: 'Betrag',
        fit: 'Passung',
        score: 'Punktzahl',
        status: 'Status',
        provisional: 'vorläufig',
        creatorRoster: 'Creator-Verzeichnis',
        search: 'Creator suchen',
        campaignTitle: 'Kampagnentitel',
        description: 'Beschreibung',
        genre: 'Zielgenre',
        minimumFollowers: 'Mindest-Follower',
        targetEngagement: 'Zielinteraktion %',
        deadline: 'Gebotsfrist',
        asset: 'Währung',
        budget: 'Budget',
        createCampaign: 'Kampagne erstellen',
        noCampaignsTitle: 'Noch keine Kampagnen',
        noCampaignsText:
          'Erstelle eine Kampagne, um den Marktplatz zu starten.',
        noBidsTitle: 'Noch keine Gebote',
        noBidsText: 'Für diese Kampagne wurden noch keine Gebote abgegeben.',
        noCreatorsTitle: 'Keine Creator gefunden',
        noCreatorsText: 'Kein Creator entspricht der aktuellen Suche.',
        events: {
          creator: { created: 'Creator beigetreten' },
          campaign: {
            created: 'Kampagne erstellt',
            closed: 'Auktion geschlossen'
          },
          bid: {
            created: 'Neues Gebot eingegangen',
            updated: 'Gebot geändert',
            finalized: 'Gebot finalisiert'
          }
        }
      },
      error: {
        title: 'Diese Seite konnte nicht geladen werden.',
        retry: 'Erneut versuchen',
        generic: 'Etwas ist schiefgelaufen',
        codes: {
          invalid_request:
            'Prüfe die eingegebenen Werte und versuche es erneut.',
          not_found: 'Das angeforderte Element existiert nicht mehr.',
          invalid_input: 'Prüfe die eingegebenen Werte und versuche es erneut.',
          invalid_amount: 'Gib einen gültigen Betrag für diese Währung ein.',
          ineligible_creator:
            'Dieser Creator ist für die Kampagne nicht teilnahmeberechtigt.',
          campaign_unavailable:
            'Diese Kampagne ist nicht mehr für Gebote geöffnet.',
          conflict: 'Die Änderung steht im Konflikt mit bestehenden Daten.',
          constraint_violation: 'Die Änderung verletzt eine Marktplatzregel.',
          internal_error: 'Der Dienst konnte die Anfrage nicht abschließen.'
        }
      },
      loading: 'Wird geladen',
      notFound: {
        title: 'Diese Seite ist vom Drehbuch abgewichen.',
        action: 'Zurück zu den Creatorn'
      }
    }
  }
} as const;

const savedLanguage = localStorage.getItem('wepush-language');
const browserLanguage = navigator.language.toLowerCase().startsWith('de')
  ? 'de'
  : 'en';
const initialLanguage =
  savedLanguage === 'de' || savedLanguage === 'en'
    ? savedLanguage
    : browserLanguage;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: ['en', 'de'],
  interpolation: { escapeValue: false }
});

function reflectLanguage(language: string) {
  const normalized = language.startsWith('de') ? 'de' : 'en';
  document.documentElement.lang = normalized;
  localStorage.setItem('wepush-language', normalized);
}

reflectLanguage(initialLanguage);
i18n.on('languageChanged', reflectLanguage);

export default i18n;
