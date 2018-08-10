;(function () {

    "use strict";

    var root = this;
    var has_require = typeof require !== 'underfined';

    var AFRAME = root.AFRAME || has_require && require('aframe');
    if (!AFRAME) {
        throw new Error('Components requires A-FRAME');
    }

    var EARTH_RADIUS = 6378160;
    var GPS_MAX_ACCURY = 100;

    function GPSUtils() { }

    GPSUtils.getGPSPosition = function (success, error, options) {
        if (typeof (error) == 'undefined')
            error = function(err) {
                console.warn('GPSUtils ERROR(' + err.code + '): ' + err.message);
            };

        if (!('geolocation' in navigator)) {
            error({ code: 0, message: 'Geolocation is not supported by your browser' });
            return;
        }

        return navigator.geolocation.watchPosition(
            success,
            error,
            {
                enableHighAccuracy: true,
                maximumAge: options.maximumAge,
                timeout: options.timeout
            }
        );
    }

    GPSUtils.calculateDistance = function (src, dest) {

        var dlng = THREE.Math.degToRad(dest.longitude - src.longitude);
        var dlat = THREE.Math.degToRad(dest.latitude - src.latitude);

        var alpha = (Math.sin(dlat / 2) * Math.sin(dlat / 2)) +
            Math.cos(THREE.Math.degToRad(src.latitude)) * Math.cos(THREE.Math.degToRad(dest.latitude)) * (Math.sin(dlng / 2) * Math.sin(dlng / 2));
        var angle = 2 * Math.atan2(Math.sqrt(alpha), Math.sqrt(1 - alpha));

        return angle * EARTH_RADIUS;
    }

    GPSUtils.getRelativePosition = function (position, zeroCoords, coords) {
        position.x = GPSUtils.calculateDistance(zeroCoords, {
            longitude: coords.longitude,
            latitude: zeroCoords.latitude
        }) *
            (coords.longitude > zeroCoords.longitude ? 1 : -1);

        position.y = coords.altitude - zeroCoords.altitude;

        position.z = GPSUtils.calculateDistance(zeroCoords, {
            longitude: zeroCoords.longitude,
            latitude: coords.latitude
        }) *
            (coords.latitude > zeroCoords.latitude ? -1 : 1);

        return position;
    }

    GPSUtils.clearWatch = function(watchId) {
        navigator.clearWatch(watchId);
    }

    function CompassUtils() { }

    // browser agnostic orientation
    CompassUtils.getBrowserOrientation = function() {
      var orientation;
      if (screen.orientation && screen.orientation.type) {
        orientation = screen.orientation.type;
      } else {
        orientation = screen.orientation ||
                      screen.mozOrientation ||
                      screen.msOrientation;
      }
  
      /*
        'portrait-primary':      for (screen width < screen height, e.g. phone, phablet, small tablet)
                                  device is in 'normal' orientation
                                for (screen width > screen height, e.g. large tablet, laptop)
                                  device has been turned 90deg clockwise from normal
  
        'portrait-secondary':    for (screen width < screen height)
                                  device has been turned 180deg from normal
                                for (screen width > screen height)
                                  device has been turned 90deg anti-clockwise (or 270deg clockwise) from normal
  
        'landscape-primary':    for (screen width < screen height)
                                  device has been turned 90deg clockwise from normal
                                for (screen width > screen height)
                                  device is in 'normal' orientation
  
        'landscape-secondary':  for (screen width < screen height)
                                  device has been turned 90deg anti-clockwise (or 270deg clockwise) from normal
                                for (screen width > screen height)
                                  device has been turned 180deg from normal
      */
  
      
  
      // iOS
      if (orientation === undefined){
        var rotation = window.orientation
        
        switch(rotation) {
          case 0:  
          // Portrait
          orientation = "portrait-primary"
          break; 
          
          case 180:  
            // Portrait (Upside-down)
            orientation = "portrait-secondary"
            break; 
    
          case -90:  
            // Landscape (Clockwise)
            orientation = "landscape-primary"
            break;  
    
          case 90:  
            // Landscape  (Counterclockwise)
            orientation = "landscape-secondary"
            break;
        }   
      }
  
      return orientation;
    }

    CompassUtils.getCompassHeading = function (alpha, beta, gamma) {

        // Convert degrees to radians
        var alphaRad = alpha * (Math.PI / 180);
        var betaRad = beta * (Math.PI / 180);
        var gammaRad = gamma * (Math.PI / 180);

        // Calculate equation components
        var cA = Math.cos(alphaRad);
        var sA = Math.sin(alphaRad);
        var cB = Math.cos(betaRad);
        var sB = Math.sin(betaRad);
        var cG = Math.cos(gammaRad);
        var sG = Math.sin(gammaRad);

        // Calculate A, B, C rotation components
        var rA = - cA * sG - sA * sB * cG;
        var rB = - sA * sG + cA * sB * cG;
        var rC = - cB * cG;

        // Calculate compass heading
        var compassHeading = Math.atan(rA / rB);

        // Convert from half unit circle to whole unit circle
        if (rB < 0) {
            compassHeading += Math.PI;
        } else if (rA < 0) {
            compassHeading += 2 * Math.PI;
        }

        // Convert radians to degrees
        compassHeading *= 180 / Math.PI;

        return compassHeading;
    }

    function Road(points) {
        this.points = points;
        this.createMesh();
    }

    Road.prototype.extractRoadPoints = function (point1, point2) {

        // Vector from [point2] to [point1]
        var vector = {
            x: point2.x - point1.x,
            y: point2.y - point1.y,
            z: point2.z - point1.z,
        }

        var vOxz = {
            x: 0,
            y: 1,
            z: 0
        };

        var vectorVertices = {
            x: vector.y * vOxz.z - vector.z * vOxz.y,
            y: vector.z * vOxz.x - vector.x * vOxz.z,
            z: vector.x * vOxz.y - vector.y * vOxz.x,
        };

        var t = Math.sqrt(2 * 2 / (vectorVertices.x * vectorVertices.x + vectorVertices.y * vectorVertices.y + vectorVertices.z * vectorVertices.z));

        var sidePoint11 = {
            x: point1.x + vectorVertices.x * t,
            y: point1.y + vectorVertices.y * t,
            z: point1.z + vectorVertices.z * t,
        }

        var sidePoint12 = {
            x: point1.x - vectorVertices.x * t,
            y: point1.y - vectorVertices.y * t,
            z: point1.z - vectorVertices.z * t,
        }

        var sidePoint21 = {
            x: point2.x + vectorVertices.x * t,
            y: point2.y + vectorVertices.y * t,
            z: point2.z + vectorVertices.z * t,
        }

        var sidePoint22 = {
            x: point2.x - vectorVertices.x * t,
            y: point2.y - vectorVertices.y * t,
            z: point2.z - vectorVertices.z * t,
        }

        return [sidePoint11, sidePoint12, sidePoint21, sidePoint22];
    }

    // Create a THREE.Mesh for road drawing using THREE.CatmullRomCurve3 (point detection) and THREE.MeshBasicMaterial
    Road.prototype.createMesh = function () {
        if (!this.points) {
            throw new Error('Road points is not set');
        }

        var geometry = new THREE.Geometry();

        var points = [];
        this.points.forEach(point => {
            points.push(new THREE.Vector3(point.x, point.y, point.z));
        });

        // Create a closed wavey loop
        var curve = new THREE.CatmullRomCurve3(points);

        var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, side: THREE.DoubleSide, opacity: 0.5 });

        // Create a triangular geometry
        points = curve.getPoints(100 * points.length);

        var roadPoints = [];

        var length = points.length;

        for (var i = 0; i < length - 1; i++) {
            roadPoints = roadPoints.concat(this.extractRoadPoints(points[i], points[i + 1]));
        }

        roadPoints = roadPoints.concat(this.extractRoadPoints(points[length - 1], points[length - 2]));

        for (var i = 0; i < roadPoints.length; i++) {
            var face = new THREE.Face3(i, i + 1, i + 2);
            geometry.vertices.push(new THREE.Vector3(roadPoints[i].x, roadPoints[i].y, roadPoints[i].z));

            if (i < roadPoints.length - 2) {
                //face.color.set(new THREE.Color(Math.random() * 0xffffff - 1));
                face.color.set(new THREE.Color(0xffff00));
                geometry.faces.push(face);
            }
        }

        // The face normals and vertex normals can be calculated automatically if not supplied above
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        this.mesh = new THREE.Mesh(geometry, material);
    }

    // Component
    AFRAME.registerComponent('gps-position', {

        watchId: null,
        zeroCoords: null,
        coords: null,

        schema: {
            accuracy: {
                type: 'int',
                default: GPS_MAX_ACCURY
            },
            'zero-crd-latitude': {
                type: 'number',
                default: NaN
            },
            'zero-crd-longitude': {
                type: 'number',
                default: NaN
            }
        },

        init: function () {
            // Set coordinate of the O point (x, y, x) = (0, 0, 0) if it is preset in code
            if (!isNaN(this.data['zero-crd-latitude']) && !isNaN(this.data['zero-crd-longitude'])) {
                this.zeroCoords = {
                    latitude: this.data['zero-crd-latitude'],
                    longitude: this.data['zero-crd-longitude']
                };
            }

            // Get and save the result of 'navigator.geolocation.watchPosition'  as watching id
            this.watchId = this.watchGPS(this.watchGPSSuccess.bind(this));
        },

        watchGPS: function (success, error) {
            return GPSUtils.getGPSPosition(success, error, { maximumAge: 0, timeout: 27000 });
        },

        watchGPSSuccess: function (position) {
            // After watching position successfully, update coordinate of component
            this.coords = position.coords;
            // Update relative position in AR/VR scence
            this.updatePosition();
        },

        updatePosition: function () {
            if (this.coords.accuracy > this.data.accuracy) { return; }

            if (!this.zeroCoords) { this.zeroCoords = this.coords; }

            var p = GPSUtils.getRelativePosition(this.el.getAttribute('position'), this.zeroCoords, this.coords);
            this.el.setAttribute('position', p);
        },

        remove: function () {
            if (this.watchId) {
                GPSUtils.clearWatch(watchId);
            }
            this.watchId = null;EARTH_RADIUS
        }

    });

    AFRAME.registerComponent('compass-rotation', {

        lookControls: null,
        lastTimestamp: 0,
        heading: null,
        defaultOrientation: null,
        currentOrientation: null,

        schema: {
            fixTime: {
                type: 'int',
                default: 100
            },
            orientationEvent: {
                type: 'string',
                default: 'auto'
            }
        },

        init: function () {

            if (typeof (this.el.components['look-controls']) == 'undefined') { return; }

            this.lookControls = this.el.components['look-controls'];

            var initSetting = this.data.orientationEvent;

            if (initSetting == 'auto') {
                if ('ondeviceorientationabsolute' in window) {
                    this.data.orientationEvent = 'deviceorientationabsolute';
                } else if ('ondeviceorientation' in window) {
                    this.data.orientationEvent = 'deviceorientation';
                } else {
                    this.data.orientationEvent = '';
                    console.error('Compass not supported');
                    return;
                }
            }

            if (screen.width > screen.height) {
                this.defaultOrientation = "landscape";
            } else {
                this.defaultOrientation = "portrait";
            }

            window.addEventListener(this.data.orientationEvent, this.handlerOrientation.bind(this), false);

            // Event listener for 'compassneedscalibration'
            window.addEventListener(
                'compassneedscalibration',
                function (event) {
                    alert('Your compass needs calibrating! Wave your device in a figure-eight motion.');
                    event.preventDefault();
                },
                true);
        },

        tick: function (time, timeDelta) {
            if (this.heading === null || this.lastTimestamp > (time - this.data.fixTime)) { return; }

            this.lastTimestamp = time;
            this.updateRotation();
        },

        handlerOrientation: function (evt) {

            var heading = null;

            if (typeof (evt.webkitCompassHeading) != 'undefined') {

                if (evt.webkitCompassAccuracy < 50) {
                    heading = evt.webkitCompassHeading;
                } else {
                    console.warn('webkitCompassAccuracy is evt.webkitCompassAccuracy');
                }

            } else if (evt.alpha !== null) {
                if (evt.absolute === true || typeof (evt.absolute) == 'undefined') {
                    heading = CompassUtils.getCompassHeading(evt.alpha, evt.beta, evt.gamma);
                } else {
                    console.warn('evt.absolute === false');
                }
            } else {
                console.warn('evt.alpha === null');
            }

             // Adjust compass heading
            var adjustment = 0;
            if(this.defaultOrientation === "landscape"){
                adjustment = -90;
            }

            var browserOrientation = CompassUtils.getBrowserOrientation();
            if (typeof browserOrientation !== "undefined") {
                this.currentOrientation = browserOrientation.split("-");

                if (this.defaultOrientation !== this.currentOrientation[0]) {
                    if (this.defaultOrientation === "landscape") {
                      adjustment -= 270;
                    } else {
                      adjustment -= 90;
                    }
                }

                if (this.currentOrientation[1] === "secondary") {
                    adjustment -= 180;
                }
            }

            heading = heading + adjustment;

            this.heading = heading;
        },

        updateRotation: function () {
            var heading = 360 - this.heading;

            var cameraRotation = this.el.getAttribute('rotation').y;
            var yawRotation = THREE.Math.radToDeg(this.lookControls.yawObject.rotation.y);

            // var adjustment = 0
            // var deviceOrientation = CompassUtils.getBrowserOrientation();
            // if (typeof deviceOrientation !== "undefined") {
            //     var currentOrientation = deviceOrientation.split("-");
        
            //     if (currentOrientation[0] === "landscape") {
            //         adjustment -= 270; 
            //     } else {
            //         adjustment -= 90;
            //     }
        
            //     if (currentOrientation[1] === "secondary") {
            //       adjustment -= 180;
            //     }
            // }

            var offset = (heading - (cameraRotation - yawRotation)) % 360;
            //var offset = heading + adjustment;

            this.lookControls.yawObject.rotation.y = THREE.Math.degToRad(offset);
        },

        remove: function () {
            if (this.data.orientationEvent) {
                window.removeEventListener(this.data.orientationEvent, this.handlerOrientation, false);
            }
        }

    });

    AFRAME.registerComponent('road', {
        cameraGpsPosition: null,
        deferredInitIntervalId: 0,

        schema: {
            latitude: {
                type: 'number',
                default: 0
            },
            longitude: {
                type: 'number',
                default: 0
            },
            cameraSelector: {
                type: 'string',
                default: 'a-camera, [camera]'
            }
        },

        // Path
        points: [
            { latitude: 21.046306, longitude: 105.7937535, altitude: 0 },
            { latitude: 21.046296, longitude: 105.7940615, altitude: 0 },    
            { latitude: 21.046309, longitude: 105.794953, altitude: 0 }
        ],

        init: function () {
            if (this.deferredInit()) { return; }

            this.deferredInitIntervalId = setInterval(this.deferredInit.bind(this), 1000);
        },

        // Try go get GPS position for zero coords
        deferredInit: function () {

            if (!this.cameraGpsPosition) {
                var camera = document.querySelector(this.data.cameraSelector);
                if (typeof (camera.components['gps-position']) == 'undefined') { return; }
                this.cameraGpsPosition = camera.components['gps-position'];
            }

            if (!this.cameraGpsPosition.zeroCoords) { return; }

            this.updatePosition();

            clearInterval(this.deferredInitIntervalId);
            this.deferredInitIntervalId = 0;

            return true;
        },

        updatePosition: function () {
            if (this.points) {
                var relativePoints = [];

                this.points.forEach(point => {
                    var p = { x: 0, y: 0, z: 0 };

                    GPSUtils.getRelativePosition(p, this.cameraGpsPosition.zeroCoords, point);

                    relativePoints.push(p);
                });

                // Change to meshline
                var roadMesh = new Road(relativePoints);

                this.el.setObject3D('mesh', roadMesh.mesh);
            }
        }
    });

}).call(this);