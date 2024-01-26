import { ItemType, ObjectDefinitions, type ItemDefinition } from "../utils/objectDefinitions";

export interface ArmorDefinition extends ItemDefinition {
    readonly itemType: ItemType.Armor
    readonly armorType: ArmorType
    readonly level: number
    readonly damageReduction: number
}

export enum ArmorType {
    Helmet,
    Vest
}

export const Armors = new ObjectDefinitions<ArmorDefinition>([
    {
        idString: "basic_helmet",
        name: "Basic Helmet",
        itemType: ItemType.Armor,
        armorType: ArmorType.Helmet,
        level: 1,
        damageReduction: 0.1
    },
    {
        idString: "regular_helmet",
        name: "Regular Helmet",
        itemType: ItemType.Armor,
        armorType: ArmorType.Helmet,
        level: 2,
        damageReduction: 0.15
    },
    {
        idString: "tactical_helmet",
        name: "Tactical Helmet",
        itemType: ItemType.Armor,
        armorType: ArmorType.Helmet,
        level: 3,
        damageReduction: 0.2
    },
    //
    // Vests
    //
    {
        idString: "basic_vest",
        name: "Basic Vest",
        itemType: ItemType.Armor,
        armorType: ArmorType.Vest,
        level: 1,
        damageReduction: 0.2
    },
    {
        idString: "regular_vest",
        name: "Regular Vest",
        itemType: ItemType.Armor, //  each item has to have a type (for armor, .Armor)
        armorType: ArmorType.Vest, // Helmets and vests are differently typed.
        level: 2,
        damageReduction: 0.35
    },
    {
        idString: "tactical_vest",
        name: "Tactical Vest",
        itemType: ItemType.Armor,
        armorType: ArmorType.Vest,
        level: 3,
        damageReduction: 0.45 // damage reduction % as a decimal
    }
]); // to add our own custom armors, the mod loader  has to have a hook in here, or the object definitions