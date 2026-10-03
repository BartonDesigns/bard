// Capture before subsystem cleanup removes objects. Geometry/material disposal alone
// leaves texture allocations, instance buffers, skeletons and light targets alive.
export function captureResources(scene, { renderer = null, materials: extraMaterials = [], textures = [], keepTextures = [] } = {}) {
	const geometries = new Set(), materials = new Set(), maps = new Set(textures.filter(Boolean));
	const instances = new Set(), skeletons = new Set(), shadows = new Set();
	const visited = new Set(), keep = new Set(keepTextures);
	function textureValues(value) {
		if (!value || typeof value !== 'object' || visited.has(value)) return;
		visited.add(value);
		if (value.isTexture) { maps.add(value); return; }
		if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) {
			for (const v of Object.values(value)) textureValues(v);
		}
	}
	function material(m) {
		if (!m?.isMaterial || materials.has(m)) return;
		materials.add(m);
		for (const v of Object.values(m)) if (v?.isTexture) textureValues(v);
		textureValues(m.uniforms);
		textureValues(m.userData);
		// onBeforeCompile can inject maps that are not exposed on the material itself.
		textureValues(renderer?.properties.get(m).uniforms);
	}
	for (const m of extraMaterials) material(m);
	scene.traverse((o) => {
		if (o.geometry) geometries.add(o.geometry);
		for (const m of [].concat(o.material || [])) material(m);
		material(o.customDepthMaterial); material(o.customDistanceMaterial);
		if (o.isInstancedMesh) instances.add(o);
		if (o.skeleton) skeletons.add(o.skeleton);
		if (o.shadow) shadows.add(o.shadow);
	});
	textureValues(scene.background); textureValues(scene.environment);
	let disposed = false;
	return () => {
		if (disposed) return;
		disposed = true;
		for (const s of shadows) s.dispose();
		for (const s of skeletons) s.dispose();
		for (const o of instances) o.dispose();
		for (const g of geometries) g.dispose();
		for (const m of materials) m.dispose();
		// Target owners release their attachments; the source texture's dispose event
		// also evicts Three's derived environment maps (PMREM/cube conversions).
		for (const t of maps) if (!keep.has(t)) t.dispose();
		geometries.clear(); materials.clear(); maps.clear(); instances.clear(); skeletons.clear(); shadows.clear(); visited.clear();
	};
}
