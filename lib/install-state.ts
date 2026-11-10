/**
 * L'application est-elle installée ? (navigateur uniquement)
 *
 * Deux signes, parce qu'aucun ne suffit seul :
 *  - on tourne DANS l'application installée (`display-mode: standalone`) ;
 *  - ce navigateur l'a installée un jour — retenu au moment de l'installation
 *    ou de la première ouverture installée. C'est ce qui permet, dans un simple
 *    onglet Chrome, de ne plus proposer ce qui est déjà sur le bureau.
 *
 * Aucun navigateur ne dit à une page, depuis un onglet ordinaire, si elle est
 * installée : un compte qui a installé ailleurs (autre ordinateur) n'est pas
 * reconnu. C'est sans gravité — au pire, on lui propose d'installer ici aussi.
 */

const CLE = "mamafacture-installed";

export function runsInstalled(): boolean {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
}

export function rememberInstalled(): void {
  try {
    localStorage.setItem(CLE, "1");
  } catch {
    // Stockage indisponible : on retombera sur `runsInstalled()`.
  }
}

export function isInstalled(): boolean {
  if (runsInstalled()) {
    rememberInstalled();
    return true;
  }
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}
