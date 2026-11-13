/** Client-safe tutor types (the service module is server-only). */
import type { UIMessage } from "ai";

import type { TutorMessageMetadata } from "@/types/contracts";

export type TutorUIMessage = UIMessage<TutorMessageMetadata>;
