import { BaseCharacter } from './base.character';
import { KnightCharacter } from './knight.character';
import { ArcherCharacter } from './archer.character';
import { MageCharacter } from './mage.character';
import { SamuraiCharacter } from './samurai.character';

const charactersMap: { [key: string]: BaseCharacter } = {
    knight: new KnightCharacter(),
    archer: new ArcherCharacter(),
    mage: new MageCharacter(),
    samurai: new SamuraiCharacter()
};

export function getCharacterLogic(type: string): BaseCharacter {
    return charactersMap[type] || charactersMap['knight'];
}