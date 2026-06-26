import { emptyDocument, type DocumentData } from "./types.js";

let data: DocumentData = emptyDocument();

export const store = {
  data(): DocumentData {
    return data;
  },
  replace(next: DocumentData): void {
    data = next;
  },
};
