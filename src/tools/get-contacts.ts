import { store } from "../whatsapp/store.js";
import { isConnected } from "../whatsapp/client.js";

export interface GetContactsParams {
  query?: string;
}

export async function getContacts({ query }: GetContactsParams) {
  if (!isConnected()) {
    return { error: "WhatsApp is not connected. Please authenticate first." };
  }

  let filtered = Array.from(store.contacts.entries()).map(([id, contact]) => ({
    id,
    name: contact.name || contact.notify || id,
    isGroup: id.endsWith("@g.us"),
  }));

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.includes(q)
    );
  }

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}
