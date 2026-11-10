"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pendingNews, type NewsEntry } from "@/lib/changelog";
import { isInstalled } from "@/lib/install-state";

/**
 * « Quoi de neuf » : s'ouvre une fois après une mise à jour annoncée dans
 * `lib/changelog.ts`, puis plus jamais pour cette annonce. Réservée aux
 * abonnés Premium — les règles sont dans `pendingNews()`.
 *
 * Ce qui a été vu est retenu dans `localStorage`, donc par navigateur : un
 * commerçant qui l'a lu au bureau la reverra une fois sur son téléphone. C'est
 * une annonce, pas une donnée — la revoir ne coûte rien. Stockage inaccessible :
 * on ne l'ouvre pas du tout, plutôt que de la rouvrir à chaque page.
 */

const CLE = "mamafacture-news-seen";

export function NewsDialog({ orgCreatedAt, premium }: { orgCreatedAt: string; premium: boolean }) {
  const [entry, setEntry] = React.useState<NewsEntry | null>(null);

  React.useEffect(() => {
    try {
      setEntry(
        pendingNews(localStorage.getItem(CLE), orgCreatedAt, { premium, installed: isInstalled() }),
      );
    } catch {
      setEntry(null);
    }
  }, [orgCreatedAt, premium]);

  if (!entry) return null;

  const fermer = (open: boolean) => {
    if (open) return;
    try {
      localStorage.setItem(CLE, entry.id);
    } catch {
      // Sans stockage, la fenêtre ne s'ouvre de toute façon pas.
    }
    setEntry(null);
  };

  return (
    <Dialog.Root open onOpenChange={fermer}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-raised animate-fade-in">
          <div className="bg-sidebar px-6 pb-7 pt-8 text-center text-sidebar-foreground">
            <span
              className="mx-auto flex size-14 items-center justify-center rounded-md bg-sidebar-mark text-sidebar-mark-foreground"
              aria-hidden
            >
              <Sparkles className="size-7" />
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-sidebar-mark">
              Nouveautés
            </p>
            <Dialog.Title className="mt-2 text-xl font-bold tracking-tight">
              {entry.title}
            </Dialog.Title>
          </div>

          <div className="px-6 pb-6 pt-5">
            <Dialog.Description className="sr-only">
              Ce qui a changé dans MaMaFacture.
            </Dialog.Description>
            <ul className="space-y-3 text-sm">
              {entry.items.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                    aria-hidden
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>

            <Dialog.Close asChild>
              <Button size="lg" className="mt-6 w-full">
                J&apos;ai compris
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
