import {
	ElementRef,
	Injector,
	Signal,
	WritableSignal,
	afterNextRender,
	computed,
	isSignal,
	signal,
	untracked,
} from '@angular/core';
import { BodyShapeType } from '@pmndrs/cannon-worker-api';
import { injectPhysicsApi } from 'angular-three-cannon';
import { injectDebugApi } from 'angular-three-cannon/debug';
import { resolveRef } from 'angular-three-core-new';
import { assertInjector } from 'ngxtension/assert-injector';
import { injectAutoEffect } from 'ngxtension/auto-effect';
import { DynamicDrawUsage, InstancedMesh, Object3D } from 'three';
import { NgtcArgFn, NgtcBodyPropsMap, NgtcBodyPublicApi, NgtcGetByIndex } from './types';
import { defaultTransformArgs, makeBodyApi, prepare, setupCollision } from './utils';

export interface NgtcBodyOptions<TShape extends BodyShapeType> {
	transformArgs?: NgtcArgFn<NgtcBodyPropsMap[TShape]>;
	injector?: Injector;
}

function createInjectBody<TShape extends BodyShapeType>(type: TShape) {
	return <TObject extends Object3D>(
		getPropFn: NgtcGetByIndex<NgtcBodyPropsMap[TShape]>,
		ref: ElementRef<TObject> | TObject | Signal<ElementRef<TObject> | TObject | undefined>,
		options?: NgtcBodyOptions<TShape>,
	) => injectBody<TShape, TObject>(type, getPropFn, ref, options);
}

function injectBody<TShape extends BodyShapeType, TObject extends Object3D>(
	type: TShape,
	getPropFn: NgtcGetByIndex<NgtcBodyPropsMap[TShape]>,
	ref: ElementRef<TObject> | TObject | Signal<ElementRef<TObject> | TObject | undefined>,
	{ transformArgs, injector }: NgtcBodyOptions<TShape> = {},
): Signal<NgtcBodyPublicApi | null> {
	return assertInjector(injectBody, injector, () => {
		const physicsApi = injectPhysicsApi({ optional: true });

		if (!physicsApi) {
			throw new Error(`[NGT Cannon] injectBody was called outside of <ngtc-physics>`);
		}

		const autoEffect = injectAutoEffect();
		const debugApi = injectDebugApi({ optional: true });

		const { add: addToDebug, remove: removeFromDebug } = debugApi?.snapshot || {};
		const transform = transformArgs ?? defaultTransformArgs[type];
		const worker = physicsApi.select('worker');
		const bodyRef = isSignal(ref) ? ref : signal(ref);
		const body = computed(() => resolveRef(bodyRef()));
		const api = computed(() => {
			const [_body, _worker, snapshot] = [body(), worker(), physicsApi.snapshot];
			if (!_body || !_worker) return null;
			return makeBodyApi(_body, _worker, snapshot);
		});

		afterNextRender(() => {
			autoEffect(() => {
				const currentWorker = worker();
				if (!currentWorker) return;

				const object = body();

				if (!isSignal(ref) && !object) {
					untracked(() => {
						(bodyRef as WritableSignal<TObject | undefined>).set(resolveRef(ref));
					});
					return;
				}

				if (!object) return;

				const [uuid, props] = (() => {
					let uuids: string[] = [];
					let temp: Object3D;
					if (object instanceof InstancedMesh) {
						object.instanceMatrix.setUsage(DynamicDrawUsage);
						uuids = new Array(object.count).fill(0).map((_, i) => `${object.uuid}/${i}`);
						temp = new Object3D();
					} else {
						uuids = [object.uuid];
					}
					return [
						uuids,
						uuids.map((id, index) => {
							const props = getPropFn(index);
							if (temp) {
								prepare(temp, props);
								(object as unknown as InstancedMesh).setMatrixAt(index, temp.matrix);
								(object as unknown as InstancedMesh).instanceMatrix.needsUpdate = true;
							} else {
								prepare(object, props);
							}
							physicsApi.snapshot.refs[id] = object;
							addToDebug?.(id, props, type);
							setupCollision(physicsApi.snapshot.events, props, id);
							// @ts-expect-error - if args is undefined, there's default
							return { ...props, args: transform(props.args) };
						}),
					];
				})();
				// Register on mount, unregister on unmount
				currentWorker.addBodies({
					props: props.map(({ onCollide, onCollideBegin, onCollideEnd, ...serializableProps }) => {
						return { onCollide: Boolean(onCollide), ...serializableProps };
					}),
					type,
					uuid,
				});

				return () => {
					uuid.forEach((id) => {
						delete physicsApi.snapshot.refs[id];
						removeFromDebug?.(id);
						delete physicsApi.snapshot.events[id];
					});
					currentWorker.removeBodies({ uuid });
				};
			});
		});

		return api;
	});
}

export const injectBox = createInjectBody('Box');
export const injectConvexPolyhedron = createInjectBody('ConvexPolyhedron');
export const injectCylinder = createInjectBody('Cylinder');
export const injectHeightfield = createInjectBody('Heightfield');
export const injectParticle = createInjectBody('Particle');
export const injectPlane = createInjectBody('Plane');
export const injectSphere = createInjectBody('Sphere');
export const injectTrimesh = createInjectBody('Trimesh');
export const injectCompound = createInjectBody('Compound');
