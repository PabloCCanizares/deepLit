export function getOpenAlexArticleStatus({
  inLibrary = false,
  inCurrentCollection = false,
  hasActiveCollection = false,
  collectionName = '',
} = {}) {
  const safeCollectionName = collectionName || 'la colección activa'

  if (hasActiveCollection) {
    if (inCurrentCollection) {
      return {
        badgeLabel: 'En colección',
        badgeTone: 'status-collection',
        actionLabel: 'Quitar de la colección',
        actionTitle: `Quitar de "${safeCollectionName}"`,
        actionIcon: 'fas fa-minus',
      }
    }

    if (inLibrary) {
      return {
        badgeLabel: 'En biblioteca',
        badgeTone: 'status-library',
        actionLabel: 'Añadir a la colección',
        actionTitle: `Añadir a "${safeCollectionName}"`,
        actionIcon: 'fas fa-plus',
      }
    }

    return {
      badgeLabel: 'No guardado',
      badgeTone: 'status-new',
      actionLabel: 'Guardar y añadir',
      actionTitle: `Guardar en tu biblioteca y añadir a "${safeCollectionName}"`,
      actionIcon: 'far fa-bookmark',
    }
  }

  if (inLibrary) {
    return {
      badgeLabel: 'En biblioteca',
      badgeTone: 'status-library',
      actionLabel: 'Quitar de la biblioteca',
      actionTitle: 'Quitar de tu biblioteca',
      actionIcon: 'fas fa-minus',
    }
  }

  return {
    badgeLabel: 'No guardado',
    badgeTone: 'status-new',
    actionLabel: 'Guardar en biblioteca',
    actionTitle: 'Guardar en tu biblioteca',
    actionIcon: 'far fa-bookmark',
  }
}
