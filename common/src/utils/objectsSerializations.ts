import { AnimationType, ObjectCategory, PlayerActions } from "../constants";
import { Armors, type ArmorDefinition } from "../definitions/armors";
import { Backpacks, type BackpackDefinition } from "../definitions/backpacks";
import { Buildings, type BuildingDefinition } from "../definitions/buildings";
import { Decals, type DecalDefinition } from "../definitions/decals";
import { type HealingItemDefinition } from "../definitions/healingItems";
import { Loots, type LootDefinition, type WeaponDefinition } from "../definitions/loots";
import { Obstacles, RotationMode, type ObstacleDefinition } from "../definitions/obstacles";
import { Skins, type SkinDefinition } from "../definitions/skins";
import { SyncedParticles, type SyncedParticleDefinition } from "../definitions/syncedParticles";
import { type ThrowableDefinition } from "../definitions/throwables";
import { type Orientation, type Variation } from "../typings";
import { ObstacleSpecialRoles } from "./objectDefinitions";
import { calculateEnumPacketBits, type SuroiBitStream } from "./suroiBitStream";
import { type Vector } from "./vector";

const ANIMATION_TYPE_BITS = calculateEnumPacketBits(AnimationType);
const PLAYER_ACTIONS_BITS = calculateEnumPacketBits(PlayerActions);

export interface Fullable<T> {
    full?: T
}

type BaseObjectsNetData = {
    [K in ObjectCategory]: Fullable<object> | object
};

export type FullData<Cat extends ObjectCategory> = ObjectsNetData[Cat] & (ObjectsNetData[Cat] extends Fullable<infer S> ? { full: S } : object);

export interface ObjectsNetData extends BaseObjectsNetData { // this is how data is formatted in packets
    //
    // Player Data
    //
    [ObjectCategory.Player]: {
        position: Vector
        rotation: number
        animation?: AnimationType
        action?: ({
            type: Exclude<PlayerActions, PlayerActions.UseItem>
            item?: undefined
        } | {
            type: PlayerActions.UseItem
            item: HealingItemDefinition
        })
        full?: {
            dead: boolean
            invulnerable: boolean
            activeItem: WeaponDefinition
            skin: SkinDefinition
            helmet?: ArmorDefinition
            vest?: ArmorDefinition
            backpack: BackpackDefinition
        }
    }
    //
    // Obstacle Data
    //
    [ObjectCategory.Obstacle]: {
        scale: number
        dead: boolean
        full?: {
            definition: ObstacleDefinition
            position: Vector
            rotation: {
                orientation: Orientation
                rotation: number
            }
            variation?: Variation
            activated?: boolean
            door?: {
                offset: number
            }
        }
    }
    //
    // Loot Data
    //
    [ObjectCategory.Loot]: {
        position: Vector
        full?: {
            definition: LootDefinition
            count: number
            isNew: boolean
        }
    }
    //
    // DeathMarker Data
    //
    [ObjectCategory.DeathMarker]: {
        position: Vector
        playerID: number
        isNew: boolean
    }
    //
    // Building Data
    //
    [ObjectCategory.Building]: {
        dead: boolean
        puzzle: undefined | {
            solved: boolean
            errorSeq: boolean
        }
        full?: {
            definition: BuildingDefinition
            position: Vector
            rotation: Orientation
        }
    }
    //
    // Decal Data
    //
    [ObjectCategory.Decal]: {
        position: Vector
        rotation: number
        definition: DecalDefinition
    }
    //
    // Parachute data
    //
    [ObjectCategory.Parachute]: {
        height: number
        full?: {
            position: Vector
        }
    }
    //
    // Throwable data
    //
    [ObjectCategory.ThrowableProjectile]: {
        position: Vector
        rotation: number
        airborne: boolean
        full?: {
            definition: ThrowableDefinition
        }
    }
    //
    // Synced particle data
    //
    [ObjectCategory.SyncedParticle]: {
        position: Vector
        rotation: number
        scale?: number
        alpha?: number
        full?: {
            definition: SyncedParticleDefinition
            variant?: Variation
        }
    }
}

interface ObjectSerialization<T extends ObjectCategory> {
    serializePartial: (stream: SuroiBitStream, data: ObjectsNetData[T]) => void
    serializeFull: (stream: SuroiBitStream, data: FullData<T>) => void
    deserializePartial: (stream: SuroiBitStream) => ObjectsNetData[T]
    deserializeFull: (stream: SuroiBitStream) => FullData<T>
}

export const ObjectSerializations: { [K in ObjectCategory]: ObjectSerialization<K> } = {
    //
    // Player serialization
    //
    [ObjectCategory.Player]: {
        serializePartial(stream, data): void {
            stream.writePosition(data.position);
            stream.writeRotation(data.rotation, 16);

            const animationDirty = data.animation !== undefined;
            stream.writeBoolean(animationDirty);
            if (animationDirty) {
                stream.writeBits(data.animation!, ANIMATION_TYPE_BITS);
            }

            const action = data.action;
            const actionDirty = action !== undefined;
            stream.writeBoolean(actionDirty);
            if (actionDirty) {
                stream.writeBits(action.type, PLAYER_ACTIONS_BITS);
                if (action.item) {
                    Loots.writeToStream(stream, action.item);
                }
            }
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);

            const full = data.full;
            stream.writeBoolean(full.dead);
            stream.writeBoolean(full.invulnerable);
            Loots.writeToStream(stream, full.activeItem);
            Skins.writeToStream(stream, full.skin);
            Backpacks.writeToStream(stream, full.backpack);

            stream.writeBoolean(full.helmet !== undefined);
            if (full.helmet) {
                Armors.writeToStream(stream, full.helmet);
            }
            stream.writeBoolean(full.vest !== undefined);
            if (full.vest) {
                Armors.writeToStream(stream, full.vest);
            }
        },
        deserializePartial(stream) {
            const data: ObjectsNetData[ObjectCategory.Player] = {
                position: stream.readPosition(),
                rotation: stream.readRotation(16),
                animation: stream.readBoolean() ? stream.readBits(ANIMATION_TYPE_BITS) : undefined
            };

            if (stream.readBoolean()) { // action dirty
                const action: NonNullable<ObjectsNetData[ObjectCategory.Player]["action"]> = {
                    type: stream.readBits(PLAYER_ACTIONS_BITS),
                    item: undefined as HealingItemDefinition | undefined
                };

                if (action.type === PlayerActions.UseItem) {
                    action.item = Loots.readFromStream(stream);
                }

                data.action = action;
            }

            return data;
        },
        deserializeFull(stream) {
            const partial = this.deserializePartial(stream);

            const full: ObjectsNetData[ObjectCategory.Player]["full"] = {
                dead: stream.readBoolean(),
                invulnerable: stream.readBoolean(),
                activeItem: Loots.readFromStream(stream),
                skin: Skins.readFromStream(stream),
                backpack: Backpacks.readFromStream(stream)
            };

            if (stream.readBoolean()) {
                full.helmet = Armors.readFromStream<ArmorDefinition>(stream);
            }

            if (stream.readBoolean()) {
                full.vest = Armors.readFromStream<ArmorDefinition>(stream);
            }

            return {
                ...partial,
                full
            };
        }
    },
    //
    // Obstacle Serialization
    //
    [ObjectCategory.Obstacle]: {
        serializePartial(stream, data): void {
            stream.writeScale(data.scale);
            stream.writeBoolean(data.dead);
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
            const full = data.full;
            Obstacles.writeToStream(stream, full.definition);

            stream.writePosition(full.position);
            stream.writeObstacleRotation(full.rotation.rotation, full.definition.rotationMode);
            if (full.definition.variations !== undefined && full.variation !== undefined) {
                stream.writeVariation(full.variation);
            }
            if (full.definition.role === ObstacleSpecialRoles.Door && full.door) {
                stream.writeBits(full.door.offset, 2);
            } else if (full.definition.role === ObstacleSpecialRoles.Activatable) {
                stream.writeBoolean(full.activated ?? false);
            }
        },
        deserializePartial(stream) {
            const data: ObjectsNetData[ObjectCategory.Obstacle] = {
                scale: stream.readScale(),
                dead: stream.readBoolean()
            };
            return data;
        },
        deserializeFull(stream) {
            const partial = this.deserializePartial(stream);

            const definition = Obstacles.readFromStream(stream);

            const full: ObjectsNetData[ObjectCategory.Obstacle]["full"] = {
                definition,
                position: stream.readPosition(),
                rotation: stream.readObstacleRotation(definition.rotationMode),
                variation: definition.variations ? stream.readVariation() : undefined
            };

            if (definition.role === ObstacleSpecialRoles.Door) {
                full.door = { offset: stream.readBits(2) };
            } else if (definition.role === ObstacleSpecialRoles.Activatable) {
                full.activated = stream.readBoolean();
            }
            return {
                ...partial, full
            };
        }
    },
    //
    // Loot Serialization
    //
    [ObjectCategory.Loot]: {
        serializePartial(stream, data): void {
            stream.writePosition(data.position);
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
            Loots.writeToStream(stream, data.full.definition);
            stream.writeBits(data.full.count, 9);
            stream.writeBoolean(data.full.isNew);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition()
            };
        },
        deserializeFull(stream) {
            return {
                ...this.deserializePartial(stream),
                full: {
                    definition: Loots.readFromStream(stream),
                    count: stream.readBits(9),
                    isNew: stream.readBoolean()
                }
            };
        }
    },
    //
    // Death Marker Serialization
    //
    [ObjectCategory.DeathMarker]: {
        serializePartial(stream, data): void {
            stream.writePosition(data.position);
            stream.writeBoolean(data.isNew);
            stream.writeObjectID(data.playerID);
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
        },
        deserializePartial(stream) {
            const position = stream.readPosition();
            const isNew = stream.readBoolean();
            const playerID = stream.readObjectID();

            return {
                position,
                isNew,
                playerID
            };
        },
        deserializeFull(stream) {
            return this.deserializePartial(stream);
        }
    },
    //
    // Building Serialization
    //
    [ObjectCategory.Building]: {
        serializePartial(stream, data): void {
            stream.writeBoolean(data.dead);
            stream.writeBoolean(!!data.puzzle);
            if (data.puzzle) {
                stream.writeBoolean(data.puzzle.solved);
                stream.writeBoolean(data.puzzle.errorSeq);
            }
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
            Buildings.writeToStream(stream, data.full.definition);
            stream.writePosition(data.full.position);
            stream.writeBits(data.full.rotation, 2);
        },
        deserializePartial(stream) {
            return {
                dead: stream.readBoolean(),
                puzzle: stream.readBoolean() // is puzzle
                    ? {
                        solved: stream.readBoolean(),
                        errorSeq: stream.readBoolean()
                    }
                    : undefined
            };
        },
        deserializeFull(stream) {
            return {
                ...this.deserializePartial(stream),
                full: {
                    definition: Buildings.readFromStream(stream),
                    position: stream.readPosition(),
                    rotation: stream.readBits(2) as Orientation
                }
            };
        }
    },
    //
    // Decal Serialization
    //
    [ObjectCategory.Decal]: {
        serializePartial(stream, data): void {
            Decals.writeToStream(stream, data.definition);
            stream.writePosition(data.position);
            stream.writeObstacleRotation(data.rotation, data.definition.rotationMode ?? RotationMode.Limited);
        },
        serializeFull(stream, data): void {
            this.serializePartial(stream, data);
        },
        deserializePartial(stream) {
            const definition = Decals.readFromStream(stream);
            return {
                definition,
                position: stream.readPosition(),
                rotation: stream.readObstacleRotation(definition.rotationMode ?? RotationMode.Limited).rotation
            };
        },
        deserializeFull(stream) {
            return this.deserializePartial(stream);
        }
    },
    [ObjectCategory.Parachute]: {
        serializePartial(stream, data) {
            stream.writeFloat(data.height, 0, 1, 8);
        },
        serializeFull(stream, data) {
            this.serializePartial(stream, data);
            stream.writePosition(data.full.position);
        },
        deserializePartial(stream) {
            return {
                height: stream.readFloat(0, 1, 8)
            };
        },
        deserializeFull(stream) {
            return {
                ...this.deserializePartial(stream),
                full: {
                    position: stream.readPosition()
                }
            };
        }
    },
    [ObjectCategory.ThrowableProjectile]: {
        serializePartial(stream, data) {
            stream.writePosition(data.position);
            stream.writeRotation(data.rotation, 16);
            stream.writeBoolean(data.airborne);
        },
        serializeFull(stream, data) {
            this.serializePartial(stream, data);
            Loots.writeToStream(stream, data.full.definition);
        },
        deserializePartial(stream) {
            return {
                position: stream.readPosition(),
                rotation: stream.readRotation(16),
                airborne: stream.readBoolean()
            };
        },
        deserializeFull(stream) {
            return {
                ...this.deserializePartial(stream),
                full: {
                    definition: Loots.readFromStream(stream)
                }
            };
        }
    },
    [ObjectCategory.SyncedParticle]: {
        serializePartial(stream, data) {
            stream.writePosition(data.position);
            stream.writeRotation(data.rotation, 8);

            const writeScale = data.scale !== undefined;
            stream.writeBoolean(writeScale);
            if (writeScale) {
                stream.writeScale(data.scale!);
            }

            const writeAlpha = data.alpha !== undefined;
            stream.writeBoolean(writeAlpha);
            if (writeAlpha) {
                stream.writeFloat(data.alpha!, 0, 1, 8);
            }
        },
        serializeFull(stream, data) {
            this.serializePartial(stream, data);
            const full = data.full;
            SyncedParticles.writeToStream(stream, full.definition);

            const variant = full.variant;
            stream.writeBoolean(variant !== undefined);
            if (variant !== undefined) {
                stream.writeVariation(variant);
            }
        },
        deserializePartial(stream) {
            const data: ObjectsNetData[ObjectCategory.SyncedParticle] = {
                position: stream.readPosition(),
                rotation: stream.readRotation(8)
            };

            if (stream.readBoolean()) { // scale
                data.scale = stream.readScale();
            }

            if (stream.readBoolean()) { // alpha
                data.alpha = stream.readFloat(0, 1, 8);
            }

            return data;
        },
        deserializeFull(stream) {
            return {
                ...this.deserializePartial(stream),
                full: {
                    definition: SyncedParticles.readFromStream(stream),
                    variant: stream.readBoolean() ? stream.readVariation() : undefined
                }
            };
        }
    }
};
