import { IVideoData } from "../../src/shared/interfaces/datatransfer/IVideoData";
import * as THREE from 'three';
import { ICameraPositionResult } from "./CameraPositionManager";
import { Vector3 } from "three";
import isEqual = require("lodash.isequal");

export class MovieManager {
  video: HTMLVideoElement;
  movieScreen: THREE.Mesh | null = null;
  vPlayer: any;
  scene: THREE.Scene;
  isPlaying: boolean = false;
  isActive: boolean = false;
  vTexture: THREE.VideoTexture | null = null;
  vTextureUpdated: Date = new Date();

  activeVideoMark: IVideoData | null = null;
  videoMarks: {marker: IVideoData, pos: Vector3}[] = [];
  vMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, player: any) {
    this.vPlayer = player;
    this.scene = scene;
    this.video = document.getElementById('player_html5_api') as HTMLVideoElement;
    this.video.crossOrigin = "anonymous";
    this.vTexture = new THREE.VideoTexture(this.video);
    this.vMaterial = new THREE.MeshBasicMaterial({ map: this.vTexture, side: THREE.DoubleSide });

    this.video.onended = () => {
      this.Stop();
    }
  }

  CreateVideoMarker(ratio: [number, number]) {
    if (this.movieScreen) {
      if (this.movieScreen.userData.ratio == ratio)
        return;
      this.scene.remove(this.movieScreen);
      this.movieScreen.geometry.dispose();
    }
    var movieGeometry = new THREE.PlaneGeometry(ratio[0], ratio[1]);
    this.movieScreen = new THREE.Mesh(movieGeometry, this.vMaterial);

    this.movieScreen.userData.SkipRemove = true;
    this.movieScreen.userData.ratio = ratio;
    this.scene.add(this.movieScreen);
  }

  Stop() {
    this.isPlaying = false;
    this.vPlayer.pause();
  }

  SetVisibleStatus (status: boolean) {
    if (this.movieScreen) {
      this.movieScreen.visible = status;
      this.vMaterial.visible = status;
    }
  }

  Cleanup() {
    this.vPlayer.dispose();
  }

  Play() {
    if (this.isActive) {
      this.vPlayer.play();
      this.isPlaying = true;
    }
  }

  AddVideo(data: IVideoData) {
    this.videoMarks.push({
      marker: data,
      pos: new Vector3(data.position.X, data.position.Y, data.position.Z)
    });
  }

  ClearVideos() {
    this.videoMarks = [];
  }

  CheckVideoDistance(camera: THREE.Camera) {
    for (let i = 0; i < this.videoMarks.length; i++) {
      let data = this.videoMarks[i];
      if (data.marker.visibleDistance) {
        
        let distance = data.pos.distanceTo(camera.position);
        if (distance < data.marker.visibleDistance) {
          this.PlayVideo(data.marker);
          break;
        }
      }
    }
    //this.SetVisibleStatus(false);
    this.Stop();
  }

  PlayVideo(data: IVideoData) {
    //this.SetVisibleStatus(true);
    if (isEqual (data, this.activeVideoMark)) return;
    
    this.isActive = true;

    if (!isEqual(data.source, this.activeVideoMark?.source)) {
      this.Stop();
      this.vPlayer.src({ type: data.source.type, src: data.source.url });
    }

    this.activeVideoMark = data;

    this.CreateVideoMarker(data.source.ratio);

    this.movieScreen.position.set(data.position.X, data.position.Y, data.position.Z);
    this.movieScreen.rotation.set(data.rotation.X, data.rotation.Y, data.rotation.Z);
    this.movieScreen.scale.set(data.scale, data.scale, data.scale);

    this.movieScreen.userData.onAfterRender = (camerapos: ICameraPositionResult, scene: THREE.Scene) => {
      if (!this.movieScreen)
        return;

      if (data.visibleDistance) {
        let distance = this.movieScreen.position.distanceTo(camerapos.playerposition);
        this.movieScreen.visible = distance < data.visibleDistance;

        this.vMaterial.visible = this.movieScreen.visible;
        if (data.fadeInDistance && this.movieScreen.visible) {
          if (distance > data.fadeInDistance) {
            let opacity = THREE.MathUtils.mapLinear(distance, data.fadeInDistance, data.visibleDistance, 1, 0);
            this.vMaterial.opacity = opacity;
            this.video.volume = opacity;
          } else {
            this.vMaterial.opacity = 1;
            this.video.volume = 1;
          }
        }
      }
      if (this.movieScreen.visible && !this.isPlaying)
        this.Play();
      if (!this.movieScreen.visible && this.isPlaying)
        this.Stop();
    }

    return this.movieScreen;
  }
}