import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Pencil } from 'lucide-react';
import {
  getCountries,
  getLocationTree,
  toggleGeoNode,
  createGeoNode,
  updateGeoNode,
  createCountry,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import type { CountryResponse, GeoNode } from '../../types/admin';

interface TreeNode {
  id: string;
  name: string;
  levelId: string | null;
  parentId: string | null;
  isActive: boolean;
  level?: { id: string; countryId: string; level: number; name: string } | null;
  children: TreeNode[];
  expanded: boolean;
}

interface AddChildForm {
  parentId: string;
  parentName: string;
  countryId: string;
  levelId: string;
  levelName: string;
}

interface EditForm {
  nodeId: string;
  currentName: string;
  countryId: string;
}

export function ZonesPage() {
  const { isSuperAdmin } = useAuth();
  const [countries, setCountries] = useState<CountryResponse[]>([]);
  const [trees, setTrees] = useState<Map<string, TreeNode>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState('');
  const [addChildForm, setAddChildForm] = useState<AddChildForm | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editName, setEditName] = useState('');

  const fetchAll = () => {
    getCountries()
      .then((res) => {
        setCountries(res.data);
        res.data.forEach((c) => {
          loadTree(c.id);
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const loadTree = async (countryId: string) => {
    const res = await getLocationTree(countryId);
    setTrees((prev) => {
      const next = new Map(prev);
      const current = next.get(countryId);
      const expandedIds = current ? collectExpandedIds(current) : new Set<string>();
      const newTree = buildTree(res.data, expandedIds);
      next.set(countryId, newTree);
      return next;
    });
  };

  const collectExpandedIds = (node: TreeNode): Set<string> => {
    const ids = new Set<string>();
    if (node.expanded) ids.add(node.id);
    node.children.forEach((c) => {
      collectExpandedIds(c).forEach((id) => ids.add(id));
    });
    return ids;
  };

  const buildTree = (node: GeoNode, expandedIds?: Set<string>): TreeNode => ({
    id: node.id,
    name: node.name,
    levelId: node.levelId,
    parentId: node.parentId,
    isActive: node.isActive,
    level: node.level,
    children: (node.children || []).map((c) => buildTree(c, expandedIds)),
    expanded: expandedIds ? expandedIds.has(node.id) : false,
  });

  const updateTreeImmutably = (
    countryId: string,
    updater: (root: TreeNode) => TreeNode,
  ) => {
    setTrees((prev) => {
      const next = new Map(prev);
      const tree = next.get(countryId);
      if (!tree) return prev;
      next.set(countryId, updater(tree));
      return next;
    });
  };

  const handleToggle = async (nodeId: string, countryId: string) => {
    if (!isSuperAdmin()) return;
    setActionLoading(nodeId);
    try {
      const res = await toggleGeoNode(nodeId);
      updateTreeImmutably(countryId, (root) =>
        updateNodeInTree(root, nodeId, (node) => ({
          ...node,
          isActive: res.data.isActive,
          children: node.children.map((c) => ({ ...c, isActive: false })),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  const updateNodeInTree = (
    root: TreeNode,
    targetId: string,
    updater: (node: TreeNode) => TreeNode,
  ): TreeNode => {
    if (root.id === targetId) return updater(root);
    return {
      ...root,
      children: root.children.map((c) =>
        updateNodeInTree(c, targetId, updater),
      ),
    };
  };

  const toggleExpand = (countryId: string, nodeId: string) => {
    updateTreeImmutably(countryId, (root) =>
      updateNodeInTree(root, nodeId, (node) => ({
        ...node,
        expanded: !node.expanded,
      })),
    );
  };

  const getCountryForNode = (nodeId: string): { country: CountryResponse; countryId: string } | null => {
    for (const [countryId, tree] of trees.entries()) {
      if (findInTree(tree, nodeId)) {
        const country = countries.find((c) => c.id === countryId);
        if (country) return { country, countryId };
      }
    }
    return null;
  };

  const findInTree = (node: TreeNode, targetId: string): boolean => {
    if (node.id === targetId) return true;
    return node.children.some((c) => findInTree(c, targetId));
  };

  const getNextLevel = (node: TreeNode): { levelId: string; levelName: string } | null => {
    const result = getCountryForNode(node.id);
    if (!result) return null;
    const nodeLevelNum = node.level?.level ?? 0;
    const nextLevel = result.country.levels.find((l) => l.level === nodeLevelNum + 1);
    if (!nextLevel) return null;
    return { levelId: nextLevel.id, levelName: nextLevel.name };
  };

  const openAddChild = (node: TreeNode) => {
    const nextLevel = getNextLevel(node);
    if (!nextLevel) {
      setError('No hay un nivel siguiente definido para este país.');
      return;
    }
    const result = getCountryForNode(node.id);
    if (!result) {
      setError('No se pudo determinar el país del nodo.');
      return;
    }
    setAddChildForm({
      parentId: node.id,
      parentName: node.name,
      countryId: result.countryId,
      levelId: nextLevel.levelId,
      levelName: nextLevel.levelName,
    });
    setNewChildName('');
  };

  const handleAddChild = async () => {
    if (!addChildForm || !newChildName.trim()) return;
    setActionLoading(`add-${addChildForm.parentId}`);
    try {
      await createGeoNode({
        name: newChildName.trim(),
        levelId: addChildForm.levelId,
        parentId: addChildForm.parentId,
      });
      setAddChildForm(null);
      await loadTree(addChildForm.countryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear nodo');
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (node: TreeNode) => {
    const result = getCountryForNode(node.id);
    setEditForm({
      nodeId: node.id,
      currentName: node.name,
      countryId: result?.countryId || '',
    });
    setEditName(node.name);
  };

  const handleEdit = async () => {
    if (!editForm || !editName.trim()) return;
    setActionLoading(`edit-${editForm.nodeId}`);
    try {
      await updateGeoNode(editForm.nodeId, editName.trim());
      setEditForm(null);
      await loadTree(editForm.countryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al editar nodo');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddCountry = async () => {
    if (!newCountryName.trim()) return;
    setActionLoading('new-country');
    try {
      await createCountry({
        name: newCountryName.trim(),
        levels: [
          { level: 1, name: 'Provincia' },
          { level: 2, name: 'Departamento' },
        ],
      });
      setNewCountryName('');
      setShowAddCountry(false);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear país');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Zonas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Árbol geográfico de cobertura del servicio
          </p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={() => setShowAddCountry(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors cursor-pointer"
          >
            Agregar país
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Add country modal */}
      {showAddCountry && (
        <Modal onClose={() => setShowAddCountry(false)} title="Agregar país">
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Nombre del país
            </label>
            <Input value={newCountryName} onChange={setNewCountryName} placeholder="Ej: Argentina" />
          </div>
          <ModalFooter
            onCancel={() => { setShowAddCountry(false); setNewCountryName(''); }}
            onConfirm={handleAddCountry}
            disabled={!newCountryName.trim() || actionLoading === 'new-country'}
            confirmLabel={actionLoading === 'new-country' ? 'Creando...' : 'Crear país'}
          />
        </Modal>
      )}

      {/* Add child node modal */}
      {addChildForm && (
        <Modal onClose={() => setAddChildForm(null)} title={`Agregar ${addChildForm.levelName.toLowerCase()}`}>
          <p className="text-sm text-gray-500 mt-1 mb-4">En: {addChildForm.parentName}</p>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            Nombre
          </label>
          <Input
            value={newChildName}
            onChange={setNewChildName}
            placeholder={`Nombre de la ${addChildForm.levelName.toLowerCase()}`}
          />
          <ModalFooter
            onCancel={() => setAddChildForm(null)}
            onConfirm={handleAddChild}
            disabled={!newChildName.trim() || actionLoading === `add-${addChildForm.parentId}`}
            confirmLabel={
              actionLoading === `add-${addChildForm.parentId}`
                ? 'Creando...'
                : `Crear ${addChildForm.levelName.toLowerCase()}`
            }
          />
        </Modal>
      )}

      {/* Edit node modal */}
      {editForm && (
        <Modal onClose={() => setEditForm(null)} title="Editar nodo">
          <p className="text-sm text-gray-500 mt-1 mb-4">Nombre actual: {editForm.currentName}</p>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            Nuevo nombre
          </label>
          <Input value={editName} onChange={setEditName} placeholder="Nuevo nombre del nodo" />
          <ModalFooter
            onCancel={() => setEditForm(null)}
            onConfirm={handleEdit}
            disabled={!editName.trim() || editName.trim() === editForm.currentName || actionLoading === `edit-${editForm.nodeId}`}
            confirmLabel={actionLoading === `edit-${editForm.nodeId}` ? 'Guardando...' : 'Guardar cambios'}
          />
        </Modal>
      )}

      {/* Tree */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {countries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            No hay países configurados
          </div>
        ) : (
          <div>
            {countries.map((country) => {
              const tree = trees.get(country.id);
              return (
                <div key={country.id}>
                  {tree ? (
                    <TreeNodeRow
                      node={tree}
                      depth={0}
                      countryId={country.id}
                      onToggle={handleToggle}
                      onExpand={toggleExpand}
                      onAddChild={openAddChild}
                      onEdit={openEdit}
                      isSuperAdmin={isSuperAdmin()}
                      actionLoading={actionLoading}
                    />
                  ) : (
                    <div className="px-5 py-3 text-sm text-gray-400">
                      Cargando {country.name}...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  countryId,
  onToggle,
  onExpand,
  onAddChild,
  onEdit,
  isSuperAdmin,
  actionLoading,
}: {
  node: TreeNode;
  depth: number;
  countryId: string;
  onToggle: (nodeId: string, countryId: string) => void;
  onExpand: (countryId: string, nodeId: string) => void;
  onAddChild: (node: TreeNode) => void;
  onEdit: (node: TreeNode) => void;
  isSuperAdmin: boolean;
  actionLoading: string | null;
}) {
  const hasChildren = node.children.length > 0;
  const paddingLeft = 16 + depth * 28;
  const isLoading = actionLoading === node.id;
  const canHaveChildren = depth < 2;
  const levelLabel = node.level?.name;

  const depthBg =
    depth === 0
      ? 'bg-white'
      : depth === 1
        ? 'bg-gray-50'
        : 'bg-gray-100';

  const nameStyle =
    depth === 0
      ? 'font-semibold text-base text-gray-900'
      : depth === 1
        ? 'font-medium text-sm text-gray-800'
        : 'text-sm text-gray-600';

  return (
    <div>
      <div
        className={`flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors ${depthBg}`}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '12px', height: depth === 0 ? '48px' : depth === 1 ? '44px' : '40px' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onExpand(countryId, node.id)}
            className={`p-0.5 flex-shrink-0 ${hasChildren ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-300 cursor-default'}`}
            disabled={!hasChildren}
          >
            {node.expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : hasChildren ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}
          </button>
          <span
            className={`truncate ${nameStyle} ${
              !node.isActive ? 'line-through text-gray-400' : ''
            }`}
          >
            {node.name}
          </span>
          {levelLabel && (
            <span className="hidden sm:inline-flex text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
              {levelLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isSuperAdmin && (
            <>
              {canHaveChildren && (
                <button
                  onClick={() => onAddChild(node)}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors disabled:opacity-50 px-1.5 cursor-pointer"
                  title={`Agregar sub-nivel en ${node.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onEdit(node)}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 px-1.5 cursor-pointer"
                title="Editar nombre"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {isSuperAdmin && node.parentId !== null && (
            <button
              onClick={() => onToggle(node.id, countryId)}
              disabled={!!actionLoading}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                node.isActive ? 'bg-green-600' : 'bg-gray-200'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 text-white animate-spin ml-1" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    node.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              )}
            </button>
          )}
        </div>
      </div>
      {node.expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            countryId={countryId}
            onToggle={onToggle}
            onExpand={onExpand}
            onAddChild={onAddChild}
            onEdit={onEdit}
            isSuperAdmin={isSuperAdmin}
            actionLoading={actionLoading}
          />
        ))}
    </div>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, disabled, confirmLabel }: {
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
  confirmLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">
        Cancelar
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
    />
  );
}
