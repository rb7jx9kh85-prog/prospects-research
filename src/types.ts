export type MatchMode = "0" | "1" | "2" | "3";
export type ProspectKind = "all" | "company" | "independent";

export type Category = {
  de?: string;
  fr?: string;
  it?: string;
  en?: string;
};

export type Prospect = {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  zip: string | null;
  location: string | null;
  category: Category | string | null;
  email: string | null;
  url: string | null;
  phoneNumbers: string[];
  mobileNumbers: string[];
};

export type SearchFilters = {
  keyword: string;
  location: string;
  zip: string;
  matchMode: MatchMode;
  kind: ProspectKind;
};

export type SearchHistoryItem = SearchFilters & {
  id: string;
  resultCount: number;
  createdAt: string;
};

export type SavedProspect = Prospect & {
  savedId: string;
  savedAt: string;
};
