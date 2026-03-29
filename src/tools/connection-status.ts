import { getConnectionInfo } from "../whatsapp/client.js";

export async function connectionStatus() {
  return getConnectionInfo();
}
