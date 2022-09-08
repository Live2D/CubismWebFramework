[English](README.md) / [日本語](README.ja.md)

---

# Cubism Web Framework

This is a framework for using models output by Live2D Cubism 4 Editor in applications.

It provides various functions for displaying and manipulating the model.
It is used in conjunction with the Live2D Cubism Core library to load the model.

You can use it as a JavaScript library that can be used in the browser by building.


## License

Please check the [license](LICENSE.md) before using this SDK.


## Development environment

### Node.js

* 18.8.0
* 16.17.0
* 14.20.0


### TypeScript

4.8.2


## Development environment construction

1. Install [Node.js] and [Visual Studio Code]
1. Open this project in Visual Studio Code and install the recommended extensions
    * You can check them by typing `@recommended` from the Extensions tab
1. Enter `>Tasks: Run Task` in the command palette (*View > Command Palette...*) to display the task list
1. Select `npm: install` to download the dependent packages

You can execute various commands from the task list on the command palette.

NOTE: Settings for debugging are described in `.vscode/tasks.json`.

## Task list

### `npm: build`

Builds the source file and outputs to the `dist` directory.

You can change the settings by editing `tsconfig.json`.

### `npm: test`

Performs a TypeScript type check test.

You can change the settings by editing `tsconfig.json`.

### `npm: lint`

Performs static analysis of TypeScript files in the `src` directory.

You can change the settings by editing `.eslintrc.yml`.

### `npm: lint:fix`

Performs static analysis and automatic modification of TypeScript files in the `src` directory.

You can change the settings by editing `.eslintrc.yml`.

### `npm: clean`

Deletes the build deliverable directory (`dist`).


## Components

### effect

Provides functions such as automatic blinking and lip sync to add motion information as an effect to the model.

### id

Provides functions to manage the parameter name, part name, and Drawable name set in the model with unique types.

### math

Provides arithmetic functions required for manipulating and drawing the model, such as matrix and vector calculations.

### model

Provides various functions (generate, update, destroy) for handling the model.

### motion

Provides various functions (motion playback, parameter blending) for applying motion data to the model.

### physics

Provides functions for applying transformation manipulations due to physics to the model.

### rendering

Provides a renderer that implements graphics instructions for drawing the model.

### type

Provides type definitions for use within the framework.

### utils

Provides utility functions such as JSON parser and log output.


## Live2D Cubism Core for Web

Cubism Core for Web is not included in this repository.

Please download it from the [Cubism SDK for Web].

[Cubism SDK for Web]: https://www.live2d.com/download/cubism-sdk/download-web/


## Samples

Please refer to [CubismWebSamples] for implementation examples of standard applications.

[CubismWebSamples]: https://github.com/Live2D/CubismWebSamples


## Manual

[Cubism SDK Manual](https://docs.live2d.com/cubism-sdk-manual/top/)


## Changelog

Please refer to [CHANGELOG.md](CHANGELOG.md) for the changelog of this repository.


## Contributing

There are many ways to contribute to the project: logging bugs, submitting pull requests on this GitHub, and reporting issues and making suggestions in Live2D Community.

### Forking And Pull Requests

We very much appreciate your pull requests, whether they bring fixes, improvements, or even new features. Note, however, that the wrapper is designed to be as lightweight and shallow as possible and should therefore only be subject to bug fixes and memory/performance improvements. To keep the main repository as clean as possible, create a personal fork and feature branches there as needed.

### Bugs

We are regularly checking issue-reports and feature requests at Live2D Community. Before filing a bug report, please do a search in Live2D Community to see if the issue-report or feature request has already been posted. If you find your issue already exists, make relevant comments and add your reaction.

### Suggestions

We're also interested in your feedback for the future of the SDK. You can submit a suggestion or feature request at Live2D Community. To make this process more effective, we're asking that you include more information to help define them more clearly.


## Community

If you want to suggest or ask questions about how to use the Cubism SDK between users, please use the community.

- [Live2D community](https://community.live2d.com/)
- [Live2D 公式コミュニティ (Japanese)](https://creatorsforum.live2d.com/)
