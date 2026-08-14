"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { clientInputSchema } from "@/lib/domain/schemas";
import type { ActionResult } from "@/lib/actions/invoices";

function failure(error: unknown): ActionResult<never> {
  if (error instanceof Error && (error.name === "DomainError" || error.name === "NotFoundError")) {
    return { ok: false, error: error.message };
  }
  console.error("[action client]", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function revalidateClients(clientId?: string) {
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

function validate(input: unknown) {
  const parsed = clientInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, error: null };

  const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
  return {
    data: null,
    error: {
      ok: false as const,
      error: Object.values(fieldErrors).flat()[0] ?? "Formulaire invalide.",
      fieldErrors,
    },
  };
}

export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { data, error } = validate(input);
  if (!data) return error;

  try {
    const session = await getSession();
    const client = await repositories.clients.create(session.orgId, data);
    revalidateClients(client.id);
    return { ok: true, data: { id: client.id } };
  } catch (caught) {
    return failure(caught);
  }
}

export async function updateClient(
  clientId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = validate(input);
  if (!data) return error;

  try {
    const session = await getSession();
    await repositories.clients.update(session.orgId, clientId, data);
    revalidateClients(clientId);
    return { ok: true, data: { id: clientId } };
  } catch (caught) {
    return failure(caught);
  }
}

/**
 * Archivage plutôt que suppression définitive.
 *
 * Un client déjà facturé ne peut pas disparaître : ses factures émises
 * perdraient leur contrepartie, et un document émis est immuable. Le client
 * sort donc des listes sans que l'historique ne soit touché.
 */
export async function archiveClient(clientId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.clients.archive(session.orgId, clientId);
    revalidateClients(clientId);
    return { ok: true, data: undefined };
  } catch (caught) {
    return failure(caught);
  }
}

export async function restoreClient(clientId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.clients.restore(session.orgId, clientId);
    revalidateClients(clientId);
    return { ok: true, data: undefined };
  } catch (caught) {
    return failure(caught);
  }
}
