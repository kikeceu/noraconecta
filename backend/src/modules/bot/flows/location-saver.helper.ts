import { randomUUID } from 'crypto';
import { SavedLocation } from './types';
import { UsersRepository } from '../../users/users.repository';
import { compareAddresses } from '../../../lib/llm-client';
import { promptService } from '../../prompts/prompt.service';

export const DEFAULT_MAX_SAVED_LOCATIONS = 5;

export interface LocationCandidate {
  geoNodeId?: string;
  zoneName?: string;
  lat?: number;
  lng?: number;
  address: string;
}

/**
 * Resuelve qué hacer con una dirección confirmada al final de coordinación:
 * - Si matchea (vía LLM) una entrada existente del mismo geoNodeId -> actualiza esa entrada y la mueve al frente.
 * - Si no matchea ninguna -> crea entrada nueva al frente, recorta a maxLocations.
 */
export async function upsertSavedLocationByAddress(
  usersRepository: UsersRepository,
  userId: string,
  currentLocations: SavedLocation[],
  candidate: LocationCandidate,
  maxLocations: number = DEFAULT_MAX_SAVED_LOCATIONS,
): Promise<SavedLocation[]> {
  const sameZoneEntries = currentLocations.filter((loc) => loc.geoNodeId === candidate.geoNodeId);

  for (const existing of sameZoneEntries) {
    const promptTemplate = await promptService.getPrompt('compare_addresses');
    const isMatch = await compareAddresses(existing.address, candidate.address, promptTemplate);
    if (isMatch) {
      const merged: SavedLocation = {
        ...existing,
        ...candidate,
        updatedAt: new Date().toISOString(),
      };
      const updated = [merged, ...currentLocations.filter((loc) => loc.id !== existing.id)];
      await usersRepository.updateSavedLocations(userId, updated);
      return updated;
    }
  }

  const newEntry: SavedLocation = {
    id: randomUUID(),
    ...candidate,
    updatedAt: new Date().toISOString(),
  };

  let updated = [newEntry, ...currentLocations];
  if (updated.length > maxLocations) {
    // descartar la entrada con updatedAt más antiguo
    updated = updated
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, maxLocations);
  }

  await usersRepository.updateSavedLocations(userId, updated);
  return updated;
}

/**
 * Encuentra entradas guardadas que coincidan por geoNodeId (para ofrecer como sugerencia
 * cuando el usuario no quiere escribir la dirección en coordinación).
 */
export function findLocationsByGeoNode(
  currentLocations: SavedLocation[],
  geoNodeId: string | undefined,
): SavedLocation[] {
  if (!geoNodeId) return [];
  return currentLocations.filter((loc) => loc.geoNodeId === geoNodeId);
}

/**
 * Marca una entrada existente como "más reciente" (la mueve al frente) sin modificar su contenido.
 */
export async function touchSavedLocation(
  usersRepository: UsersRepository,
  userId: string,
  currentLocations: SavedLocation[],
  locationId: string,
): Promise<SavedLocation[]> {
  const index = currentLocations.findIndex((loc) => loc.id === locationId);
  if (index === -1) return currentLocations;

  const touched = { ...currentLocations[index], updatedAt: new Date().toISOString() };
  const updated = [touched, ...currentLocations.filter((_, i) => i !== index)];

  await usersRepository.updateSavedLocations(userId, updated);
  return updated;
}
