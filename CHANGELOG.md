# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).


## [4-r.5] - 2022-09-08

### Added

* Add the multilingual supported documents.
* Add immediate stabilization of physics.
* Implemented a process to switch between `CubismJson` parsing and `JSON.parse()`.


## [4-r.5-beta.5] - 2022-08-04

### Fixed

* Fix `csmGetMocVersion` function argument.
* Fix a bug in which processing was interrupted when an invalid vertex was specified in the middle of a physics operation.
* Fix crash with exception when reading .moc3 files of unsupported versions.
* Fix physics system input to be split by the physics setting time.


## [4-r.5-beta.4] - 2022-07-07

### Added

* Add a function to get the latest .moc3 Version and the .moc3 Version of the loaded model.
* Add a function to get the type of parameters of the model.
* Add a function to get the parent part of the model's Drawable.


## [4-r.5-beta.3] - 2022-06-16

### Fixed

* `getDrawableTextureIndices` function in `CubismModel` has been renamed to `getDrawableTextureIndex` because the name was not correct.
  * `getDrawableTextureIndices` function is marked as deprecated.
* Fix physics system behaviour when exists Physics Fps Setting in .physics3.json.


## [4-r.5-beta.2] - 2022-06-02

### Fixed

* Fixed a bug that caused Multiply Color / Screen Color of different objects to be applied.
  * See `CHANGELOG.md` in Core.
  * No modifications to Samples and Framework.


## [4-r.5-beta.1] - 2022-05-19

### Added

* Add processing related to Multiply Color / Screen Color added in Cubism 4.2.

### Fixed

* Fix usage of Anisotropy filtering.
* Fix model was not displayed when the number of masks exceeded the limit.
* Fix getTextureDirectory() to return the directory name of the 0th texture path.


## [4-r.4] - 2021-12-09

### Fixed

* Fix useless void 0.
* Fix a warning when `SegmentType` could not be obtained when loading motion.
* Fix return correct error values for out-of-index arguments in cubismjson by [@cocor-au-lait](https://github.com/cocor-au-lait).
* Fix a bug that motions currently played do not fade out when play a motion.


## [4-r.3] - 2021-06-10

### Fixed

* Fix motion event time value from Int to Float.


## [4-r.3-beta.1] - 2021-05-13

### Added

* Implement a function to get the correct value when the time axis of the Bezier handle cannot be linear.


## [4-r.2] - 2021-03-09

### Fixed

* Fix implementation of `iterator#increment` in `csmmap` and `csmvector`.
* Fix delay in starting fade-out for expressions.
* Fix Physics input reflect flag on evaluate.
* Fix reference size of model matrix.
* Fix `Int` to `Float` when getting `PhysicsSettings.Vertices.Radius` in `physics3.json` parsing.
   * **[INFO]** This fix may change the behavior of the physics operations.
     The behavior changes if the value of `PhysicsSettings.Vertices.Radius` in `physics3.json` is less than `1.0`.
     If you want to return to the behavior before Cubism SDK for Web R1,
     change the value of the corresponding `PhysicsSettings.Vertices.Radius` to `0`.
   * This fix is related to fix applied to `Cubism Editor 4.0.05 beta1` and later.
     Please see [Cubism Editor Changelog](https://docs.live2d.com/cubism-editor-manual/updates4/).
      * **Fix physics and scene blending settings where the length of the pendulum would be converted to an integer when displayed.**

### Changed

* Rename the function name that handles seconds from `Time` to `Seconds`.
* Avoiding needless namespace syntax to simplify imports by [@cocor-au-lait](https://github.com/cocor-au-lait)


## [4-r.1] - 2020-01-30

### Added

* Add `.editorconfig`, `.gitattributes` and `.gitignore`.
* Add document `README.md` and `CHANGELOG.md`.
* Add `package.json` for development and build.
* Add Prettier and ESLint for format and check code quolity.

### Changed

* Move source files to `/src` directory.
* Reformat code using Prettier and ESLint.


[4-r.5]: https://github.com/Live2D/CubismWebFramework/compare/4-r.5-beta.5...4-r.5
[4-r.5-beta.5]: https://github.com/Live2D/CubismWebFramework/compare/4-r.5-beta.4...4-r.5-beta.5
[4-r.5-beta.4]: https://github.com/Live2D/CubismWebFramework/compare/4-r.5-beta.3...4-r.5-beta.4
[4-r.5-beta.3]: https://github.com/Live2D/CubismWebFramework/compare/4-r.5-beta.2...4-r.5-beta.3
[4-r.5-beta.2]: https://github.com/Live2D/CubismWebFramework/compare/4-r.5-beta.1...4-r.5-beta.2
[4-r.5-beta.1]: https://github.com/Live2D/CubismWebFramework/compare/4-r.4...4-r.5-beta.1
[4-r.4]: https://github.com/Live2D/CubismWebFramework/compare/4-r.3...4-r.4
[4-r.3]: https://github.com/Live2D/CubismWebFramework/compare/4-r.3-beta.1...4-r.3
[4-r.3-beta.1]: https://github.com/Live2D/CubismWebFramework/compare/4-r.2...4-r.3-beta.1
[4-r.2]: https://github.com/Live2D/CubismWebFramework/compare/4-r.1...4-r.2
[4-r.1]: https://github.com/Live2D/CubismWebFramework/compare/ce2585a919ac6e99f64dd468933772c6f1abbcc7...4-r.1
