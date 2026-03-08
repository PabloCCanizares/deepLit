import { createContext, useContext, useState, useEffect } from "react";
import { collectionsAPI } from "../api/api";
import { useAuth } from "./AuthContext";

const CollectionContext = createContext();
export const useCollection = () => useContext(CollectionContext);

export const CollectionProvider = ({ children }) => {
  const { user } = useAuth();  // Saber si hay sesión

  const [collections, setCollections] = useState([]); // Lista completa de colecciones
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    localStorage.getItem("selectedCollection") || null
  );

  // Cargar colecciones solo si hay usuario
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const resp = await collectionsAPI.getAll();
        const fetchedCollections = resp?.data?.collections || [];
        setCollections(fetchedCollections);
        console.log("Colecciones recargadas", fetchedCollections);

        // Si la coleccion seleccionada ya no existe, volver a "Sin coleccion"
        if (
          selectedCollectionId &&
          !fetchedCollections.some((collection) => collection._id === selectedCollectionId)
        ) {
          setSelectedCollectionId(null);
          localStorage.removeItem("selectedCollection");
        }
      } catch (err) {
        console.error("Error cargando colecciones:", err);
        setCollections([]);
      }
    })();
  }, [user, selectedCollectionId]);

  // Cambiar colección seleccionada
  const changeCollection = (id) => {
    if (!id) {
      setSelectedCollectionId(null);
      localStorage.removeItem("selectedCollection");
    } else {
      setSelectedCollectionId(id);
      console.log("Colección seleccionada:", id);
      localStorage.setItem("selectedCollection", id);
    }
  };

  // Recargar colecciones desde la API (si se crea una nueva)
  const refreshCollections = async () => {
    if (!user) return; // proteger si no hay sesión
    try {
      const resp = await collectionsAPI.getAll();
      setCollections(resp.data.collections);
      
    } catch (err) {
      console.error(err);
      setCollections([]);
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
