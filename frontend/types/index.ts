export type ToneType = "warm" | "hype" | "witty" | "professional";

export type BusinessType =
    | "boutique_retail"
    | "cafe_restaurant"
    | "conference_event"
    | "gym_fitness"
    | "hotel_hospitality"
    | "bookstore_library"
    | "salon_spa"
    | "office_lobby";

export interface Space {
    id: string;
    user_id: string;
    name: string;
    business_type: BusinessType;
    tone: ToneType;
    context: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Greeting {
    id: string;
    space_id: string;
    text: string;
    created_at: string;
}
