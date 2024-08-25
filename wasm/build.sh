#!/bin/bash

# Your existing build commands
wasm-pack build --target web

# Remove the .gitignore file created by wasm-bindgen
rm pkg/.gitignore