import { createContext, useContext, useState, useEffect } from "react";
import { collectionsAPI } from "../api/index.js";
import { useAuth } from "./AuthContext";

const CollectionContext = createContext();
export const useCollection = () => useContext(CollectionContext);

export const CollectionProvider = ({ children }) => {
  const { user } = useAuth();  // Saber si hay sesión

  const [collections, setCollections] = useState([]); // Lista completa de colecciones
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    localStorage.getItem("selectedCollection") || null
  );

  const clearSelectedCollection = () => {
    setSelectedCollectionId(null);
    localStorage.removeItem("selectedCollection");
  };

  const syncCollectionsState = (fetchedCollections) => {
    setCollections(fetchedCollections);

    if (
      selectedCollectionId &&
      !fetchedCollections.some((collection) => collection._id === selectedCollectionId)
    ) {
      clearSelectedCollection();
    }
  };

  // Recargar colecciones desde la API (crear/editar/borrar)
  const refreshCollections = async () => {
    if (!user) {
      setCollections([]);
      return [];
    }

    try {
      const resp = await collectionsAPI.getAll();
      const fetchedCollections = resp?.data?.collections || [];
      syncCollectionsState(fetchedCollections);
      return fetchedCollections;
    } catch (err) {
      console.error("Error cargando colecciones:", err);
      setCollections([]);
      return [];
    }
  };

  // Cargar colecciones solo si hay usuario
  useEffect(() => {
    if (!user) {
      setCollections([]);
      return;
    }

    refreshCollections();
  }, [user]);

  // Cambiar colección seleccionada
  const changeCollection = (id) => {
    if (!id) {
      clearSelectedCollection();
    } else {
      setSelectedCollectionId(id);
      localStorage.setItem("selectedCollection", id);
    }
  };

  return (
    <CollectionContext.Provider
      value={{
        collections,             // [{id, name}]
        selectedCollectionId,     // id de la colección seleccionada
        changeCollection,
        refreshCollections,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
};
