import { describeCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";

export const GET = async () => Response.json(await describeCatalog(dataClient()));
