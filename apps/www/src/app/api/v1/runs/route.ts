import { dataClient } from "@/lib/data";

/** Every published run, by date, oldest first. */
export const GET = async () => {
  const { latest, dates } = await dataClient().getIndex();
  return Response.json({ latest, dates });
};
