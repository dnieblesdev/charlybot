import { SimpleStorage } from "../../infrastructure/storage/SimpleStorage.ts";

export interface VerificationRequest {
  id: string;
  userId: string;
  guildId: string;
  inGameName: string;
  screenshotUrl: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  messageId?: string;
}

interface VerificationData {
  requests: Record<string, VerificationRequest>;
}

const storage = new SimpleStorage<VerificationData>("verifications.json");

async function getVerificationData(): Promise<VerificationData> {
  const data = await storage.read();
  if (!data) {
    const newData: VerificationData = { requests: {} };
    await storage.write(newData);
    return newData;
  }
  return data;
}

export async function createVerificationRequest(
  request: VerificationRequest,
): Promise<void> {
  const data = await getVerificationData();
  data.requests[request.id] = request;
  await storage.write(data);
}

export async function getVerificationRequest(
  id: string,
): Promise<VerificationRequest | null> {
  const data = await getVerificationData();
  return data.requests[id] || null;
}

export async function updateVerificationRequest(
  id: string,
  updates: Partial<VerificationRequest>,
): Promise<void> {
  const data = await getVerificationData();
  if (data.requests[id]) {
    data.requests[id] = { ...data.requests[id], ...updates };
    await storage.write(data);
  }
}

export async function getPendingRequests(
  guildId: string,
): Promise<VerificationRequest[]> {
  const data = await getVerificationData();
  return Object.values(data.requests).filter(
    (req) => req.guildId === guildId && req.status === "pending",
  );
}

export async function deleteVerificationRequest(id: string): Promise<void> {
  const data = await getVerificationData();
  delete data.requests[id];
  await storage.write(data);
}
