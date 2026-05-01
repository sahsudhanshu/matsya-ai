/*
! tailwindcss v3.3.2 | MIT License | https://tailwindcss.com
*/

/*
1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)
2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)
*/

*,
::before,
::after {
  box-sizing: border-box;
  /* 1 */
  border-width: 0;
  /* 2 */
  border-style: solid;
  /* 2 */
  border-color: #e5e7eb;
  /* 2 */
}

::before,
::after {
  --tw-content: '';
}

/*
1. Use a consistent sensible line-height in all browsers.
2. Prevent adjustments of font size after orientation changes in iOS.
3. Use a more readable tab size.
4. Use the user's configured `sans` font-family by default.
5. Use the user's configured `sans` font-feature-settings by default.
6. Use the user's configured `sans` font-variation-settings by default.
*/

html {
  line-height: 1.5;
  /* 1 */
  -webkit-text-size-adjust: 100%;
  /* 2 */
  -moz-tab-size: 4;
  /* 3 */
  -o-tab-size: 4;
     tab-size: 4;
  /* 3 */
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  /* 4 */
  font-feature-settings: normal;
  /* 5 */
  font-variation-settings: normal;
  /* 6 */
}

/*
1. Remove the margin in all browsers.
2. Inherit line-height from `html` so users can set them as a class directly on the `html` element.
*/

body {
  margin: 0;
  /* 1 */
  line-height: inherit;
  /* 2 */
}

/*
1. Add the correct height in Firefox.
2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)
3. Ensure horizontal rules are visible by default.
*/

hr {
  height: 0;
  /* 1 */
  color: inherit;
  /* 2 */
  border-top-width: 1px;
  /* 3 */
}

/*
Add the correct text decoration in Chrome, Edge, and Safari.
*/

abbr:where([title]) {
  -webkit-text-decoration: underline dotted;
          text-decoration: underline dotted;
}

/*
Remove the default font size and weight for headings.
*/

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

/*
Reset links to optimize for opt-in styling instead of opt-out.
*/

a {
  color: inherit;
  text-decoration: inherit;
}

/*
Add the correct font weight in Edge and Safari.
*/

b,
strong {
  font-weight: bolder;
}

/*
1. Use the user's configured `mono` font family by default.
2. Correct the odd `em` font sizing in all browsers.
*/

code,
kbd,
samp,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  /* 1 */
  font-size: 1em;
  /* 2 */
}

/*
Add the correct font size in all browsers.
*/

small {
  font-size: 80%;
}

/*
Prevent `sub` and `sup` elements from affecting the line height in all browsers.
*/

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

/*
1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)
2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)
3. Remove gaps between table borders by default.
*/

table {
  text-indent: 0;
  /* 1 */
  border-color: inherit;
  /* 2 */
  border-collapse: collapse;
  /* 3 */
}

/*
1. Change the font styles in all browsers.
2. Remove the margin in Firefox and Safari.
3. Remove default padding in all browsers.
*/

button,
input,
optgroup,
select,
textarea {
  font-family: inherit;
  /* 1 */
  font-size: 100%;
  /* 1 */
  font-weight: inherit;
  /* 1 */
  line-height: inherit;
  /* 1 */
  color: inherit;
  /* 1 */
  margin: 0;
  /* 2 */
  padding: 0;
  /* 3 */
}

/*
Remove the inheritance of text transform in Edge and Firefox.
*/

button,
select {
  text-transform: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Remove default button styles.
*/

button,
[type='button'],
[type='reset'],
[type='submit'] {
  -webkit-appearance: button;
  /* 1 */
  background-color: transparent;
  /* 2 */
  background-image: none;
  /* 2 */
}

/*
Use the modern Firefox focus style for all focusable elements.
*/

:-moz-focusring {
  outline: auto;
}

/*
Remove the additional `:invalid` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)
*/

:-moz-ui-invalid {
  box-shadow: none;
}

/*
Add the correct vertical alignment in Chrome and Firefox.
*/

progress {
  vertical-align: baseline;
}

/*
Correct the cursor style of increment and decrement buttons in Safari.
*/

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

/*
1. Correct the odd appearance in Chrome and Safari.
2. Correct the outline style in Safari.
*/

[type='search'] {
  -webkit-appearance: textfield;
  /* 1 */
  outline-offset: -2px;
  /* 2 */
}

/*
Remove the inner padding in Chrome and Safari on macOS.
*/

::-webkit-search-decoration {
  -webkit-appearance: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Change font properties to `inherit` in Safari.
*/

::-webkit-file-upload-button {
  -webkit-appearance: button;
  /* 1 */
  font: inherit;
  /* 2 */
}

/*
Add the correct display in Chrome and Safari.
*/

summary {
  display: list-item;
}

/*
Removes the default spacing and border for appropriate elements.
*/

blockquote,
dl,
dd,
h1,
h2,
h3,
h4,
h5,
h6,
hr,
figure,
p,
pre {
  margin: 0;
}

fieldset {
  margin: 0;
  padding: 0;
}

legend {
  padding: 0;
}

ol,
ul,
menu {
  list-style: none;
  margin: 0;
  padding: 0;
}

/*
Prevent resizing textareas horizontally by default.
*/

textarea {
  resize: vertical;
}

/*
1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)
2. Set the default placeholder color to the user's configured gray 400 color.
*/

input::-moz-placeholder, textarea::-moz-placeholder {
  opacity: 1;
  /* 1 */
  color: #9ca3af;
  /* 2 */
}

input::placeholder,
textarea::placeholder {
  opacity: 1;
  /* 1 */
  color: #9ca3af;
  /* 2 */
}

/*
Set the default cursor for buttons.
*/

button,
[role="button"] {
  cursor: pointer;
}

/*
Make sure disabled buttons don't get the pointer cursor.
*/

:disabled {
  cursor: default;
}

/*
1. Make replaced elements `display: block` by default. (https://github.com/mozdevs/cssremedy/issues/14)
2. Add `vertical-align: middle` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)
   This can trigger a poorly considered lint error in some tools but is included by design.
*/

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block;
  /* 1 */
  vertical-align: middle;
  /* 2 */
}

/*
Constrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)
*/

img,
video {
  max-width: 100%;
  height: auto;
}

/* Make elements with the HTML hidden attribute stay hidden by default */

[hidden] {
  display: none;
}

:root {
  --css-interop-darkMode: media;
  --css-interop: true;
  --css-interop-nativewind: true;
}

*, ::before, ::after {
  --tw-border-spacing-x: 0;
  --tw-border-spacing-y: 0;
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-pan-x:  ;
  --tw-pan-y:  ;
  --tw-pinch-zoom:  ;
  --tw-scroll-snap-strictness: proximity;
  --tw-gradient-from-position:  ;
  --tw-gradient-via-position:  ;
  --tw-gradient-to-position:  ;
  --tw-ordinal:  ;
  --tw-slashed-zero:  ;
  --tw-numeric-figure:  ;
  --tw-numeric-spacing:  ;
  --tw-numeric-fraction:  ;
  --tw-ring-inset:  ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
  --tw-blur:  ;
  --tw-brightness:  ;
  --tw-contrast:  ;
  --tw-grayscale:  ;
  --tw-hue-rotate:  ;
  --tw-invert:  ;
  --tw-saturate:  ;
  --tw-sepia:  ;
  --tw-drop-shadow:  ;
  --tw-backdrop-blur:  ;
  --tw-backdrop-brightness:  ;
  --tw-backdrop-contrast:  ;
  --tw-backdrop-grayscale:  ;
  --tw-backdrop-hue-rotate:  ;
  --tw-backdrop-invert:  ;
  --tw-backdrop-opacity:  ;
  --tw-backdrop-saturate:  ;
  --tw-backdrop-sepia:  ;
}

::backdrop {
  --tw-border-spacing-x: 0;
  --tw-border-spacing-y: 0;
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-pan-x:  ;
  --tw-pan-y:  ;
  --tw-pinch-zoom:  ;
  --tw-scroll-snap-strictness: proximity;
  --tw-gradient-from-position:  ;
  --tw-gradient-via-position:  ;
  --tw-gradient-to-position:  ;
  --tw-ordinal:  ;
  --tw-slashed-zero:  ;
  --tw-numeric-figure:  ;
  --tw-numeric-spacing:  ;
  --tw-numeric-fraction:  ;
  --tw-ring-inset:  ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
  --tw-blur:  ;
  --tw-brightness:  ;
  --tw-contrast:  ;
  --tw-grayscale:  ;
  --tw-hue-rotate:  ;
  --tw-invert:  ;
  --tw-saturate:  ;
  --tw-sepia:  ;
  --tw-drop-shadow:  ;
  --tw-backdrop-blur:  ;
  --tw-backdrop-brightness:  ;
  --tw-backdrop-contrast:  ;
  --tw-backdrop-grayscale:  ;
  --tw-backdrop-hue-rotate:  ;
  --tw-backdrop-invert:  ;
  --tw-backdrop-opacity:  ;
  --tw-backdrop-saturate:  ;
  --tw-backdrop-sepia:  ;
}

.container {
  width: 100%;
}

@media (min-width: 640px) {
  .container {
    max-width: 640px;
  }
}

@media (min-width: 768px) {
  .container {
    max-width: 768px;
  }
}

@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
}

@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}

@media (min-width: 1536px) {
  .container {
    max-width: 1536px;
  }
}

.\!visible {
  visibility: visible !important;
}

.visible {
  visibility: visible;
}

.fixed {
  position: fixed;
}

.absolute {
  position: absolute;
}

.relative {
  position: relative;
}

.-right-0 {
  right: -0px;
}

.-right-0\.5 {
  right: -0.125rem;
}

.-top-0 {
  top: -0px;
}

.-top-0\.5 {
  top: -0.125rem;
}

.bottom-0 {
  bottom: 0px;
}

.bottom-20 {
  bottom: 5rem;
}

.bottom-4 {
  bottom: 1rem;
}

.bottom-5 {
  bottom: 1.25rem;
}

.bottom-9 {
  bottom: 2.25rem;
}

.bottom-\[-1px\] {
  bottom: -1px;
}

.bottom-\[4px\] {
  bottom: 4px;
}

.bottom-\[56px\] {
  bottom: 56px;
}

.left-0 {
  left: 0px;
}

.left-2 {
  left: 0.5rem;
}

.left-4 {
  left: 1rem;
}

.left-\[4px\] {
  left: 4px;
}

.left-md {
  left: 16px;
}

.right-0 {
  right: 0px;
}

.right-1 {
  right: 0.25rem;
}

.right-1\.5 {
  right: 0.375rem;
}

.right-2 {
  right: 0.5rem;
}

.right-20 {
  right: 5rem;
}

.right-3 {
  right: 0.75rem;
}

.right-4 {
  right: 1rem;
}

.right-\[-1px\] {
  right: -1px;
}

.right-\[-4px\] {
  right: -4px;
}

.right-\[4px\] {
  right: 4px;
}

.right-\[62px\] {
  right: 62px;
}

.top-0 {
  top: 0px;
}

.top-1 {
  top: 0.25rem;
}

.top-1\.5 {
  top: 0.375rem;
}

.top-1\/2 {
  top: 50%;
}

.top-2 {
  top: 0.5rem;
}

.top-3 {
  top: 0.75rem;
}

.top-4 {
  top: 1rem;
}

.top-8 {
  top: 2rem;
}

.top-\[-4px\] {
  top: -4px;
}

.top-\[4px\] {
  top: 4px;
}

.top-\[50px\] {
  top: 50px;
}

.top-\[52px\] {
  top: 52px;
}

.top-md {
  top: 16px;
}

.z-10 {
  z-index: 10;
}

.z-20 {
  z-index: 20;
}

.z-30 {
  z-index: 30;
}

.z-40 {
  z-index: 40;
}

.z-50 {
  z-index: 50;
}

.z-\[1000\] {
  z-index: 1000;
}

.z-\[9999\] {
  z-index: 9999;
}

.m-lg {
  margin: 24px;
}

.mx-1 {
  margin-left: 0.25rem;
  margin-right: 0.25rem;
}

.mx-2 {
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}

.mx-4 {
  margin-left: 1rem;
  margin-right: 1rem;
}

.my-2 {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.my-4 {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.my-md {
  margin-top: 16px;
  margin-bottom: 16px;
}

.my-xs {
  margin-top: 4px;
  margin-bottom: 4px;
}

.-mt-7 {
  margin-top: -1.75rem;
}

.mb-0 {
  margin-bottom: 0px;
}

.mb-0\.5 {
  margin-bottom: 0.125rem;
}

.mb-1 {
  margin-bottom: 0.25rem;
}

.mb-1\.5 {
  margin-bottom: 0.375rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mb-2\.5 {
  margin-bottom: 0.625rem;
}

.mb-3 {
  margin-bottom: 0.75rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.mb-5 {
  margin-bottom: 1.25rem;
}

.mb-6 {
  margin-bottom: 1.5rem;
}

.mb-8 {
  margin-bottom: 2rem;
}

.mb-\[14px\] {
  margin-bottom: 14px;
}

.mb-\[1px\] {
  margin-bottom: 1px;
}

.mb-\[2px\] {
  margin-bottom: 2px;
}

.mb-\[6px\] {
  margin-bottom: 6px;
}

.mb-lg {
  margin-bottom: 24px;
}

.mb-md {
  margin-bottom: 16px;
}

.mb-sm {
  margin-bottom: 8px;
}

.mb-xl {
  margin-bottom: 32px;
}

.mb-xs {
  margin-bottom: 4px;
}

.ml-0 {
  margin-left: 0px;
}

.ml-0\.5 {
  margin-left: 0.125rem;
}

.ml-1 {
  margin-left: 0.25rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.ml-3 {
  margin-left: 0.75rem;
}

.ml-4 {
  margin-left: 1rem;
}

.ml-5 {
  margin-left: 1.25rem;
}

.ml-auto {
  margin-left: auto;
}

.ml-sm {
  margin-left: 8px;
}

.mr-1 {
  margin-right: 0.25rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mr-3 {
  margin-right: 0.75rem;
}

.mr-4 {
  margin-right: 1rem;
}

.mr-md {
  margin-right: 16px;
}

.mr-sm {
  margin-right: 8px;
}

.mt-0 {
  margin-top: 0px;
}

.mt-0\.5 {
  margin-top: 0.125rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-1\.5 {
  margin-top: 0.375rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-2\.5 {
  margin-top: 0.625rem;
}

.mt-3 {
  margin-top: 0.75rem;
}

.mt-3\.5 {
  margin-top: 0.875rem;
}

.mt-4 {
  margin-top: 1rem;
}

.mt-6 {
  margin-top: 1.5rem;
}

.mt-8 {
  margin-top: 2rem;
}

.mt-\[1px\] {
  margin-top: 1px;
}

.mt-\[2px\] {
  margin-top: 2px;
}

.mt-\[3px\] {
  margin-top: 3px;
}

.mt-\[5px\] {
  margin-top: 5px;
}

.mt-\[6px\] {
  margin-top: 6px;
}

.mt-lg {
  margin-top: 24px;
}

.mt-md {
  margin-top: 16px;
}

.mt-sm {
  margin-top: 8px;
}

.mt-xl {
  margin-top: 32px;
}

.mt-xs {
  margin-top: 4px;
}

.flex {
  display: flex;
}

.table {
  display: table;
}

.grid {
  display: grid;
}

.hidden {
  display: none;
}

.aspect-square {
  aspect-ratio: 1 / 1;
}

.h-1 {
  height: 0.25rem;
}

.h-1\.5 {
  height: 0.375rem;
}

.h-10 {
  height: 2.5rem;
}

.h-11 {
  height: 2.75rem;
}

.h-12 {
  height: 3rem;
}

.h-16 {
  height: 4rem;
}

.h-2 {
  height: 0.5rem;
}

.h-3 {
  height: 0.75rem;
}

.h-3\.5 {
  height: 0.875rem;
}

.h-4 {
  height: 1rem;
}

.h-7 {
  height: 1.75rem;
}

.h-8 {
  height: 2rem;
}

.h-9 {
  height: 2.25rem;
}

.h-\[100px\] {
  height: 100px;
}

.h-\[10px\] {
  height: 10px;
}

.h-\[140px\] {
  height: 140px;
}

.h-\[14px\] {
  height: 14px;
}

.h-\[160px\] {
  height: 160px;
}

.h-\[180px\] {
  height: 180px;
}

.h-\[18px\] {
  height: 18px;
}

.h-\[1px\] {
  height: 1px;
}

.h-\[200px\] {
  height: 200px;
}

.h-\[210px\] {
  height: 210px;
}

.h-\[22px\] {
  height: 22px;
}

.h-\[24px\] {
  height: 24px;
}

.h-\[280px\] {
  height: 280px;
}

.h-\[28px\] {
  height: 28px;
}

.h-\[30px\] {
  height: 30px;
}

.h-\[34px\] {
  height: 34px;
}

.h-\[36px\] {
  height: 36px;
}

.h-\[38px\] {
  height: 38px;
}

.h-\[3px\] {
  height: 3px;
}

.h-\[40px\] {
  height: 40px;
}

.h-\[42px\] {
  height: 42px;
}

.h-\[44px\] {
  height: 44px;
}

.h-\[48px\] {
  height: 48px;
}

.h-\[4px\] {
  height: 4px;
}

.h-\[50px\] {
  height: 50px;
}

.h-\[52\%\] {
  height: 52%;
}

.h-\[52px\] {
  height: 52px;
}

.h-\[54px\] {
  height: 54px;
}

.h-\[60px\] {
  height: 60px;
}

.h-\[62px\] {
  height: 62px;
}

.h-\[68px\] {
  height: 68px;
}

.h-\[6px\] {
  height: 6px;
}

.h-\[8px\] {
  height: 8px;
}

.h-full {
  height: 100%;
}

.h-px {
  height: 1px;
}

.max-h-\[100px\] {
  max-height: 100px;
}

.max-h-\[250px\] {
  max-height: 250px;
}

.max-h-\[300px\] {
  max-height: 300px;
}

.max-h-\[38px\] {
  max-height: 38px;
}

.max-h-\[60\%\] {
  max-height: 60%;
}

.max-h-\[70\%\] {
  max-height: 70%;
}

.max-h-\[80\%\] {
  max-height: 80%;
}

.max-h-\[85\%\] {
  max-height: 85%;
}

.max-h-\[90\%\] {
  max-height: 90%;
}

.min-h-\[200px\] {
  min-height: 200px;
}

.min-h-\[300px\] {
  min-height: 300px;
}

.min-h-\[30px\] {
  min-height: 30px;
}

.min-h-\[40px\] {
  min-height: 40px;
}

.min-h-\[44px\] {
  min-height: 44px;
}

.min-h-\[46px\] {
  min-height: 46px;
}

.w-1 {
  width: 0.25rem;
}

.w-1\.5 {
  width: 0.375rem;
}

.w-1\/2 {
  width: 50%;
}

.w-1\/3 {
  width: 33.333333%;
}

.w-10 {
  width: 2.5rem;
}

.w-11 {
  width: 2.75rem;
}

.w-12 {
  width: 3rem;
}

.w-14 {
  width: 3.5rem;
}

.w-16 {
  width: 4rem;
}

.w-2 {
  width: 0.5rem;
}

.w-3 {
  width: 0.75rem;
}

.w-3\.5 {
  width: 0.875rem;
}

.w-4 {
  width: 1rem;
}

.w-5 {
  width: 1.25rem;
}

.w-7 {
  width: 1.75rem;
}

.w-8 {
  width: 2rem;
}

.w-9 {
  width: 2.25rem;
}

.w-\[100px\] {
  width: 100px;
}

.w-\[10px\] {
  width: 10px;
}

.w-\[14px\] {
  width: 14px;
}

.w-\[160px\] {
  width: 160px;
}

.w-\[18px\] {
  width: 18px;
}

.w-\[1px\] {
  width: 1px;
}

.w-\[210px\] {
  width: 210px;
}

.w-\[220px\] {
  width: 220px;
}

.w-\[22px\] {
  width: 22px;
}

.w-\[24px\] {
  width: 24px;
}

.w-\[28px\] {
  width: 28px;
}

.w-\[30px\] {
  width: 30px;
}

.w-\[34px\] {
  width: 34px;
}

.w-\[35px\] {
  width: 35px;
}

.w-\[36px\] {
  width: 36px;
}

.w-\[38px\] {
  width: 38px;
}

.w-\[3px\] {
  width: 3px;
}

.w-\[40px\] {
  width: 40px;
}

.w-\[42px\] {
  width: 42px;
}

.w-\[44px\] {
  width: 44px;
}

.w-\[47\%\] {
  width: 47%;
}

.w-\[48\%\] {
  width: 48%;
}

.w-\[48px\] {
  width: 48px;
}

.w-\[50px\] {
  width: 50px;
}

.w-\[54px\] {
  width: 54px;
}

.w-\[60px\] {
  width: 60px;
}

.w-\[62px\] {
  width: 62px;
}

.w-\[68px\] {
  width: 68px;
}

.w-\[6px\] {
  width: 6px;
}

.w-\[78\%\] {
  width: 78%;
}

.w-\[80px\] {
  width: 80px;
}

.w-full {
  width: 100%;
}

.min-w-\[120px\] {
  min-width: 120px;
}

.min-w-\[130px\] {
  min-width: 130px;
}

.min-w-\[140px\] {
  min-width: 140px;
}

.min-w-\[16px\] {
  min-width: 16px;
}

.min-w-\[200px\] {
  min-width: 200px;
}

.min-w-\[220px\] {
  min-width: 220px;
}

.min-w-\[30px\] {
  min-width: 30px;
}

.min-w-\[47\%\] {
  min-width: 47%;
}

.min-w-\[60px\] {
  min-width: 60px;
}

.max-w-\[300px\] {
  max-width: 300px;
}

.max-w-\[45\%\] {
  max-width: 45%;
}

.max-w-\[500px\] {
  max-width: 500px;
}

.max-w-\[65\%\] {
  max-width: 65%;
}

.max-w-\[78\%\] {
  max-width: 78%;
}

.max-w-\[85\%\] {
  max-width: 85%;
}

.flex-1 {
  flex: 1 1 0%;
}

.shrink {
  flex-shrink: 1;
}

.shrink-0 {
  flex-shrink: 0;
}

.flex-grow {
  flex-grow: 1;
}

.grow {
  flex-grow: 1;
}

.-translate-y-1\/2 {
  --tw-translate-y: -50%;
  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}

.transform {
  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}

.flex-row {
  flex-direction: row;
}

.flex-row-reverse {
  flex-direction: row-reverse;
}

.flex-wrap {
  flex-wrap: wrap;
}

.items-start {
  align-items: flex-start;
}

.items-end {
  align-items: flex-end;
}

.items-center {
  align-items: center;
}

.justify-start {
  justify-content: flex-start;
}

.justify-end {
  justify-content: flex-end;
}

.justify-center {
  justify-content: center;
}

.justify-between {
  justify-content: space-between;
}

.justify-around {
  justify-content: space-around;
}

.gap-0 {
  gap: 0px;
}

.gap-0\.5 {
  gap: 0.125rem;
}

.gap-1 {
  gap: 0.25rem;
}

.gap-1\.5 {
  gap: 0.375rem;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-2\.5 {
  gap: 0.625rem;
}

.gap-3 {
  gap: 0.75rem;
}

.gap-4 {
  gap: 1rem;
}

.gap-\[10px\] {
  gap: 10px;
}

.gap-\[12px\] {
  gap: 12px;
}

.gap-\[14px\] {
  gap: 14px;
}

.gap-\[2px\] {
  gap: 2px;
}

.gap-\[3px\] {
  gap: 3px;
}

.gap-\[4px\] {
  gap: 4px;
}

.gap-\[5px\] {
  gap: 5px;
}

.gap-\[6px\] {
  gap: 6px;
}

.gap-lg {
  gap: 24px;
}

.gap-md {
  gap: 16px;
}

.gap-sm {
  gap: 8px;
}

.gap-xl {
  gap: 32px;
}

.gap-xs {
  gap: 4px;
}

.space-x-3 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 0;
  margin-right: calc(0.75rem * var(--tw-space-x-reverse));
  margin-left: calc(0.75rem * calc(1 - var(--tw-space-x-reverse)));
}

.space-x-3\.5 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 0;
  margin-right: calc(0.875rem * var(--tw-space-x-reverse));
  margin-left: calc(0.875rem * calc(1 - var(--tw-space-x-reverse)));
}

.self-start {
  align-self: flex-start;
}

.self-end {
  align-self: flex-end;
}

.self-center {
  align-self: center;
}

.overflow-hidden {
  overflow: hidden;
}

.rounded {
  border-radius: 0.25rem;
}

.rounded-2xl {
  border-radius: 24px;
}

.rounded-3xl {
  border-radius: 1.5rem;
}

.rounded-\[10px\] {
  border-radius: 10px;
}

.rounded-\[12px\] {
  border-radius: 12px;
}

.rounded-\[14px\] {
  border-radius: 14px;
}

.rounded-\[16px\] {
  border-radius: 16px;
}

.rounded-\[18px\] {
  border-radius: 18px;
}

.rounded-\[20px\] {
  border-radius: 20px;
}

.rounded-\[24px\] {
  border-radius: 24px;
}

.rounded-\[3px\] {
  border-radius: 3px;
}

.rounded-\[6px\] {
  border-radius: 6px;
}

.rounded-\[8px\] {
  border-radius: 8px;
}

.rounded-full {
  border-radius: 999px;
}

.rounded-lg {
  border-radius: 16px;
}

.rounded-md {
  border-radius: 12px;
}

.rounded-none {
  border-radius: 0px;
}

.rounded-sm {
  border-radius: 8px;
}

.rounded-xl {
  border-radius: 20px;
}

.rounded-b-2xl {
  border-bottom-right-radius: 24px;
  border-bottom-left-radius: 24px;
}

.rounded-t-2xl {
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}

.rounded-t-3xl {
  border-top-left-radius: 1.5rem;
  border-top-right-radius: 1.5rem;
}

.rounded-t-\[20px\] {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}

.rounded-t-\[24px\] {
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}

.rounded-bl-\[4px\] {
  border-bottom-left-radius: 4px;
}

.rounded-bl-\[6px\] {
  border-bottom-left-radius: 6px;
}

.rounded-br-\[4px\] {
  border-bottom-right-radius: 4px;
}

.border {
  border-width: 1px;
}

.border-2 {
  border-width: 2px;
}

.border-\[0\.5px\] {
  border-width: 0.5px;
}

.border-\[1\.5px\] {
  border-width: 1.5px;
}

.border-\[2\.5px\] {
  border-width: 2.5px;
}

.border-\[3px\] {
  border-width: 3px;
}

.border-y {
  border-top-width: 1px;
  border-bottom-width: 1px;
}

.border-b {
  border-bottom-width: 1px;
}

.border-b-\[0\.5px\] {
  border-bottom-width: 0.5px;
}

.border-l {
  border-left-width: 1px;
}

.border-l-2 {
  border-left-width: 2px;
}

.border-l-\[3px\] {
  border-left-width: 3px;
}

.border-l-\[4px\] {
  border-left-width: 4px;
}

.border-r {
  border-right-width: 1px;
}

.border-r-\[0\.5px\] {
  border-right-width: 0.5px;
}

.border-t {
  border-top-width: 1px;
}

.border-t-\[0\.5px\] {
  border-top-width: 0.5px;
}

.border-t-\[3px\] {
  border-top-width: 3px;
}

.border-dashed {
  border-style: dashed;
}

.border-\[\#10b98140\] {
  border-color: #10b98140;
}

.border-\[\#10b98155\] {
  border-color: #10b98155;
}

.border-\[\#10b98166\] {
  border-color: #10b98166;
}

.border-\[\#1e40af30\] {
  border-color: #1e40af30;
}

.border-\[\#1e40af40\] {
  border-color: #1e40af40;
}

.border-\[\#22d3ee30\] {
  border-color: #22d3ee30;
}

.border-\[\#2a1b54\] {
  --tw-border-opacity: 1;
  border-color: rgb(42 27 84 / var(--tw-border-opacity));
}

.border-\[\#334155\] {
  --tw-border-opacity: 1;
  border-color: rgb(51 65 85 / var(--tw-border-opacity));
}

.border-\[\#34d39930\] {
  border-color: #34d39930;
}

.border-\[\#3b82f640\] {
  border-color: #3b82f640;
}

.border-\[\#3b82f644\] {
  border-color: #3b82f644;
}

.border-\[\#3b82f666\] {
  border-color: #3b82f666;
}

.border-\[\#3b82f6\] {
  --tw-border-opacity: 1;
  border-color: rgb(59 130 246 / var(--tw-border-opacity));
}

.border-\[\#7c3aed40\] {
  border-color: #7c3aed40;
}

.border-\[\#7c3aed50\] {
  border-color: #7c3aed50;
}

.border-\[\#818cf830\] {
  border-color: #818cf830;
}

.border-\[\#E5E7EB\] {
  --tw-border-opacity: 1;
  border-color: rgb(229 231 235 / var(--tw-border-opacity));
}

.border-\[\#ef444440\] {
  border-color: #ef444440;
}

.border-\[\#ef4444\] {
  --tw-border-opacity: 1;
  border-color: rgb(239 68 68 / var(--tw-border-opacity));
}

.border-\[\#f59e0b30\] {
  border-color: #f59e0b30;
}

.border-\[\#f59e0b66\] {
  border-color: #f59e0b66;
}

.border-\[\#f8717155\] {
  border-color: #f8717155;
}

.border-\[rgba\(16\2c 185\2c 129\2c 0\.3\)\] {
  border-color: rgba(16,185,129,0.3);
}

.border-\[rgba\(255\2c 255\2c 255\2c 0\.05\)\] {
  border-color: rgba(255,255,255,0.05);
}

.border-\[rgba\(255\2c 255\2c 255\2c 0\.06\)\] {
  border-color: rgba(255,255,255,0.06);
}

.border-\[rgba\(255\2c 255\2c 255\2c 0\.10\)\] {
  border-color: rgba(255,255,255,0.10);
}

.border-\[rgba\(255\2c 255\2c 255\2c 0\.12\)\] {
  border-color: rgba(255,255,255,0.12);
}

.border-\[rgba\(255\2c 255\2c 255\2c 0\.2\)\] {
  border-color: rgba(255,255,255,0.2);
}

.border-\[rgba\(34\2c 211\2c 238\2c 0\.33\)\] {
  border-color: rgba(34,211,238,0.33);
}

.border-bgDark {
  --tw-border-opacity: 1;
  border-color: rgb(15 23 42 / var(--tw-border-opacity));
}

.border-blue-500 {
  --tw-border-opacity: 1;
  border-color: rgb(59 130 246 / var(--tw-border-opacity));
}

.border-blue-500\/30 {
  border-color: rgb(59 130 246 / 0.3);
}

.border-borderDark {
  --tw-border-opacity: 1;
  border-color: rgb(51 65 85 / var(--tw-border-opacity));
}

.border-borderLight {
  --tw-border-opacity: 1;
  border-color: rgb(71 85 105 / var(--tw-border-opacity));
}

.border-error {
  --tw-border-opacity: 1;
  border-color: rgb(239 68 68 / var(--tw-border-opacity));
}

.border-error\/30 {
  border-color: rgb(239 68 68 / 0.3);
}

.border-error\/40 {
  border-color: rgb(239 68 68 / 0.4);
}

.border-gray-200 {
  --tw-border-opacity: 1;
  border-color: rgb(229 231 235 / var(--tw-border-opacity));
}

.border-primary {
  --tw-border-opacity: 1;
  border-color: rgb(30 64 175 / var(--tw-border-opacity));
}

.border-primary\/30 {
  border-color: rgb(30 64 175 / 0.3);
}

.border-primary\/40 {
  border-color: rgb(30 64 175 / 0.4);
}

.border-primaryLight {
  --tw-border-opacity: 1;
  border-color: rgb(59 130 246 / var(--tw-border-opacity));
}

.border-primaryLight\/40 {
  border-color: rgb(59 130 246 / 0.4);
}

.border-red-500 {
  --tw-border-opacity: 1;
  border-color: rgb(239 68 68 / var(--tw-border-opacity));
}

.border-red-500\/40 {
  border-color: rgb(239 68 68 / 0.4);
}

.border-slate-600 {
  --tw-border-opacity: 1;
  border-color: rgb(71 85 105 / var(--tw-border-opacity));
}

.border-slate-700 {
  --tw-border-opacity: 1;
  border-color: rgb(51 65 85 / var(--tw-border-opacity));
}

.border-slate-900 {
  --tw-border-opacity: 1;
  border-color: rgb(15 23 42 / var(--tw-border-opacity));
}

.border-textMuted {
  --tw-border-opacity: 1;
  border-color: rgb(148 163 184 / var(--tw-border-opacity));
}

.border-white {
  --tw-border-opacity: 1;
  border-color: rgb(255 255 255 / var(--tw-border-opacity));
}

.border-white\/10 {
  border-color: rgb(255 255 255 / 0.1);
}

.bg-\[\#0478571E\] {
  background-color: #0478571E;
}

.bg-\[\#04785722\] {
  background-color: #04785722;
}

.bg-\[\#047857\] {
  --tw-bg-opacity: 1;
  background-color: rgb(4 120 87 / var(--tw-bg-opacity));
}

.bg-\[\#0D1724\] {
  --tw-bg-opacity: 1;
  background-color: rgb(13 23 36 / var(--tw-bg-opacity));
}

.bg-\[\#0f172a\] {
  --tw-bg-opacity: 1;
  background-color: rgb(15 23 42 / var(--tw-bg-opacity));
}

.bg-\[\#0f172a\]\/95 {
  background-color: rgb(15 23 42 / 0.95);
}

.bg-\[\#0f172ae5\] {
  background-color: #0f172ae5;
}

.bg-\[\#0f172af0\] {
  background-color: #0f172af0;
}

.bg-\[\#0f3460\] {
  --tw-bg-opacity: 1;
  background-color: rgb(15 52 96 / var(--tw-bg-opacity));
}

.bg-\[\#10b98108\] {
  background-color: #10b98108;
}

.bg-\[\#10b98111\] {
  background-color: #10b98111;
}

.bg-\[\#10b98115\] {
  background-color: #10b98115;
}

.bg-\[\#10b98118\] {
  background-color: #10b98118;
}

.bg-\[\#10b981\] {
  --tw-bg-opacity: 1;
  background-color: rgb(16 185 129 / var(--tw-bg-opacity));
}

.bg-\[\#131F30\] {
  --tw-bg-opacity: 1;
  background-color: rgb(19 31 48 / var(--tw-bg-opacity));
}

.bg-\[\#1D2A3D\] {
  --tw-bg-opacity: 1;
  background-color: rgb(29 42 61 / var(--tw-bg-opacity));
}

.bg-\[\#1d4ed8\] {
  --tw-bg-opacity: 1;
  background-color: rgb(29 78 216 / var(--tw-bg-opacity));
}

.bg-\[\#1e293b\] {
  --tw-bg-opacity: 1;
  background-color: rgb(30 41 59 / var(--tw-bg-opacity));
}

.bg-\[\#1e40af15\] {
  background-color: #1e40af15;
}

.bg-\[\#1e40af20\] {
  background-color: #1e40af20;
}

.bg-\[\#1e40af28\] {
  background-color: #1e40af28;
}

.bg-\[\#1e40af30\] {
  background-color: #1e40af30;
}

.bg-\[\#1e40af33\] {
  background-color: #1e40af33;
}

.bg-\[\#1e40af80\] {
  background-color: #1e40af80;
}

.bg-\[\#1e40af\] {
  --tw-bg-opacity: 1;
  background-color: rgb(30 64 175 / var(--tw-bg-opacity));
}

.bg-\[\#2a1b54\] {
  --tw-bg-opacity: 1;
  background-color: rgb(42 27 84 / var(--tw-bg-opacity));
}

.bg-\[\#33415540\] {
  background-color: #33415540;
}

.bg-\[\#334155\] {
  --tw-bg-opacity: 1;
  background-color: rgb(51 65 85 / var(--tw-bg-opacity));
}

.bg-\[\#3B82F6\] {
  --tw-bg-opacity: 1;
  background-color: rgb(59 130 246 / var(--tw-bg-opacity));
}

.bg-\[\#3b82f615\] {
  background-color: #3b82f615;
}

.bg-\[\#3b82f618\] {
  background-color: #3b82f618;
}

.bg-\[\#3b82f622\] {
  background-color: #3b82f622;
}

.bg-\[\#3b82f633\] {
  background-color: #3b82f633;
}

.bg-\[\#3b82f660\] {
  background-color: #3b82f660;
}

.bg-\[\#3b82f6\] {
  --tw-bg-opacity: 1;
  background-color: rgb(59 130 246 / var(--tw-bg-opacity));
}

.bg-\[\#7c3aed30\] {
  background-color: #7c3aed30;
}

.bg-\[\#7c3aed\] {
  --tw-bg-opacity: 1;
  background-color: rgb(124 58 237 / var(--tw-bg-opacity));
}

.bg-\[\#d9770620\] {
  background-color: #d9770620;
}

.bg-\[\#ef444415\] {
  background-color: #ef444415;
}

.bg-\[\#ef444418\] {
  background-color: #ef444418;
}

.bg-\[\#f59e0b33\] {
  background-color: #f59e0b33;
}

.bg-\[\#f8717112\] {
  background-color: #f8717112;
}

.bg-\[\#f8717114\] {
  background-color: #f8717114;
}

.bg-\[\#f8717120\] {
  background-color: #f8717120;
}

.bg-\[rgba\(0\2c 0\2c 0\2c 0\.5\)\] {
  background-color: rgba(0,0,0,0.5);
}

.bg-\[rgba\(0\2c 0\2c 0\2c 0\.7\)\] {
  background-color: rgba(0,0,0,0.7);
}

.bg-\[rgba\(10\2c 15\2c 30\2c 0\.90\)\] {
  background-color: rgba(10,15,30,0.90);
}

.bg-\[rgba\(10\2c 15\2c 30\2c 0\.92\)\] {
  background-color: rgba(10,15,30,0.92);
}

.bg-\[rgba\(15\2c 23\2c 42\2c 0\.6\)\] {
  background-color: rgba(15,23,42,0.6);
}

.bg-\[rgba\(16\2c 185\2c 129\2c 0\.08\)\] {
  background-color: rgba(16,185,129,0.08);
}

.bg-\[rgba\(16\2c 185\2c 129\2c 0\.15\)\] {
  background-color: rgba(16,185,129,0.15);
}

.bg-\[rgba\(255\2c 255\2c 255\2c 0\.08\)\] {
  background-color: rgba(255,255,255,0.08);
}

.bg-\[rgba\(255\2c 255\2c 255\2c 0\.15\)\] {
  background-color: rgba(255,255,255,0.15);
}

.bg-\[rgba\(255\2c 255\2c 255\2c 0\.18\)\] {
  background-color: rgba(255,255,255,0.18);
}

.bg-\[rgba\(34\2c 211\2c 238\2c 0\.07\)\] {
  background-color: rgba(34,211,238,0.07);
}

.bg-\[rgba\(34\2c 211\2c 238\2c 0\.09\)\] {
  background-color: rgba(34,211,238,0.09);
}

.bg-\[rgba\(34\2c 211\2c 238\2c 0\.13\)\] {
  background-color: rgba(34,211,238,0.13);
}

.bg-\[rgba\(8\2c 12\2c 26\2c 0\.94\)\] {
  background-color: rgba(8,12,26,0.94);
}

.bg-bgCard {
  --tw-bg-opacity: 1;
  background-color: rgb(30 41 59 / var(--tw-bg-opacity));
}

.bg-bgCard\/90 {
  background-color: rgb(30 41 59 / 0.9);
}

.bg-bgDark {
  --tw-bg-opacity: 1;
  background-color: rgb(15 23 42 / var(--tw-bg-opacity));
}

.bg-bgSurface {
  --tw-bg-opacity: 1;
  background-color: rgb(51 65 85 / var(--tw-bg-opacity));
}

.bg-black {
  --tw-bg-opacity: 1;
  background-color: rgb(0 0 0 / var(--tw-bg-opacity));
}

.bg-black\/30 {
  background-color: rgb(0 0 0 / 0.3);
}

.bg-black\/50 {
  background-color: rgb(0 0 0 / 0.5);
}

.bg-black\/60 {
  background-color: rgb(0 0 0 / 0.6);
}

.bg-black\/70 {
  background-color: rgb(0 0 0 / 0.7);
}

.bg-black\/75 {
  background-color: rgb(0 0 0 / 0.75);
}

.bg-blue-50 {
  --tw-bg-opacity: 1;
  background-color: rgb(239 246 255 / var(--tw-bg-opacity));
}

.bg-blue-500 {
  --tw-bg-opacity: 1;
  background-color: rgb(59 130 246 / var(--tw-bg-opacity));
}

.bg-blue-800 {
  --tw-bg-opacity: 1;
  background-color: rgb(30 64 175 / var(--tw-bg-opacity));
}

.bg-borderDark {
  --tw-bg-opacity: 1;
  background-color: rgb(51 65 85 / var(--tw-bg-opacity));
}

.bg-borderLight {
  --tw-bg-opacity: 1;
  background-color: rgb(71 85 105 / var(--tw-bg-opacity));
}

.bg-emerald-500 {
  --tw-bg-opacity: 1;
  background-color: rgb(16 185 129 / var(--tw-bg-opacity));
}

.bg-error {
  --tw-bg-opacity: 1;
  background-color: rgb(239 68 68 / var(--tw-bg-opacity));
}

.bg-error\/10 {
  background-color: rgb(239 68 68 / 0.1);
}

.bg-error\/20 {
  background-color: rgb(239 68 68 / 0.2);
}

.bg-gray-300 {
  --tw-bg-opacity: 1;
  background-color: rgb(209 213 219 / var(--tw-bg-opacity));
}

.bg-gray-50 {
  --tw-bg-opacity: 1;
  background-color: rgb(249 250 251 / var(--tw-bg-opacity));
}

.bg-primary {
  --tw-bg-opacity: 1;
  background-color: rgb(30 64 175 / var(--tw-bg-opacity));
}

.bg-primary\/10 {
  background-color: rgb(30 64 175 / 0.1);
}

.bg-primary\/20 {
  background-color: rgb(30 64 175 / 0.2);
}

.bg-primary\/25 {
  background-color: rgb(30 64 175 / 0.25);
}

.bg-primaryDark {
  --tw-bg-opacity: 1;
  background-color: rgb(15 52 96 / var(--tw-bg-opacity));
}

.bg-primaryLight {
  --tw-bg-opacity: 1;
  background-color: rgb(59 130 246 / var(--tw-bg-opacity));
}

.bg-secondary {
  --tw-bg-opacity: 1;
  background-color: rgb(4 120 87 / var(--tw-bg-opacity));
}

.bg-secondaryLight\/20 {
  background-color: rgb(16 185 129 / 0.2);
}

.bg-slate-600 {
  --tw-bg-opacity: 1;
  background-color: rgb(71 85 105 / var(--tw-bg-opacity));
}

.bg-slate-700 {
  --tw-bg-opacity: 1;
  background-color: rgb(51 65 85 / var(--tw-bg-opacity));
}

.bg-slate-800 {
  --tw-bg-opacity: 1;
  background-color: rgb(30 41 59 / var(--tw-bg-opacity));
}

.bg-slate-900 {
  --tw-bg-opacity: 1;
  background-color: rgb(15 23 42 / var(--tw-bg-opacity));
}

.bg-success\/20 {
  background-color: rgb(16 185 129 / 0.2);
}

.bg-textMuted {
  --tw-bg-opacity: 1;
  background-color: rgb(148 163 184 / var(--tw-bg-opacity));
}

.bg-textSubtle {
  --tw-bg-opacity: 1;
  background-color: rgb(100 116 139 / var(--tw-bg-opacity));
}

.bg-transparent {
  background-color: transparent;
}

.bg-warning\/20 {
  background-color: rgb(245 158 11 / 0.2);
}

.bg-white {
  --tw-bg-opacity: 1;
  background-color: rgb(255 255 255 / var(--tw-bg-opacity));
}

.bg-white\/10 {
  background-color: rgb(255 255 255 / 0.1);
}

.bg-white\/5 {
  background-color: rgb(255 255 255 / 0.05);
}

.p-0 {
  padding: 0px;
}

.p-0\.5 {
  padding: 0.125rem;
}

.p-1 {
  padding: 0.25rem;
}

.p-1\.5 {
  padding: 0.375rem;
}

.p-2 {
  padding: 0.5rem;
}

.p-3 {
  padding: 0.75rem;
}

.p-3\.5 {
  padding: 0.875rem;
}

.p-4 {
  padding: 1rem;
}

.p-6 {
  padding: 1.5rem;
}

.p-7 {
  padding: 1.75rem;
}

.p-8 {
  padding: 2rem;
}

.p-\[10px\] {
  padding: 10px;
}

.p-\[14px\] {
  padding: 14px;
}

.p-\[3px\] {
  padding: 3px;
}

.p-\[48px\] {
  padding: 48px;
}

.p-lg {
  padding: 24px;
}

.p-md {
  padding: 16px;
}

.p-sm {
  padding: 8px;
}

.p-xl {
  padding: 32px;
}

.p-xs {
  padding: 4px;
}

.px-1 {
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.px-1\.5 {
  padding-left: 0.375rem;
  padding-right: 0.375rem;
}

.px-2 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.px-2\.5 {
  padding-left: 0.625rem;
  padding-right: 0.625rem;
}

.px-3 {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.px-3\.5 {
  padding-left: 0.875rem;
  padding-right: 0.875rem;
}

.px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}

.px-5 {
  padding-left: 1.25rem;
  padding-right: 1.25rem;
}

.px-6 {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.px-8 {
  padding-left: 2rem;
  padding-right: 2rem;
}

.px-\[10px\] {
  padding-left: 10px;
  padding-right: 10px;
}

.px-\[14px\] {
  padding-left: 14px;
  padding-right: 14px;
}

.px-\[16px\] {
  padding-left: 16px;
  padding-right: 16px;
}

.px-\[5px\] {
  padding-left: 5px;
  padding-right: 5px;
}

.px-\[6px\] {
  padding-left: 6px;
  padding-right: 6px;
}

.px-lg {
  padding-left: 24px;
  padding-right: 24px;
}

.px-md {
  padding-left: 16px;
  padding-right: 16px;
}

.px-sm {
  padding-left: 8px;
  padding-right: 8px;
}

.px-xs {
  padding-left: 4px;
  padding-right: 4px;
}

.py-0 {
  padding-top: 0px;
  padding-bottom: 0px;
}

.py-0\.5 {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}

.py-1 {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.py-1\.5 {
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
}

.py-12 {
  padding-top: 3rem;
  padding-bottom: 3rem;
}

.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.py-2\.5 {
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

.py-3 {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.py-3\.5 {
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.py-6 {
  padding-top: 1.5rem;
  padding-bottom: 1.5rem;
}

.py-8 {
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.py-\[10px\] {
  padding-top: 10px;
  padding-bottom: 10px;
}

.py-\[13px\] {
  padding-top: 13px;
  padding-bottom: 13px;
}

.py-\[14px\] {
  padding-top: 14px;
  padding-bottom: 14px;
}

.py-\[1px\] {
  padding-top: 1px;
  padding-bottom: 1px;
}

.py-\[2px\] {
  padding-top: 2px;
  padding-bottom: 2px;
}

.py-\[3px\] {
  padding-top: 3px;
  padding-bottom: 3px;
}

.py-\[48px\] {
  padding-top: 48px;
  padding-bottom: 48px;
}

.py-\[4px\] {
  padding-top: 4px;
  padding-bottom: 4px;
}

.py-\[5px\] {
  padding-top: 5px;
  padding-bottom: 5px;
}

.py-\[6px\] {
  padding-top: 6px;
  padding-bottom: 6px;
}

.py-\[7px\] {
  padding-top: 7px;
  padding-bottom: 7px;
}

.py-lg {
  padding-top: 24px;
  padding-bottom: 24px;
}

.py-md {
  padding-top: 16px;
  padding-bottom: 16px;
}

.py-sm {
  padding-top: 8px;
  padding-bottom: 8px;
}

.py-xs {
  padding-top: 4px;
  padding-bottom: 4px;
}

.pb-1 {
  padding-bottom: 0.25rem;
}

.pb-12 {
  padding-bottom: 3rem;
}

.pb-16 {
  padding-bottom: 4rem;
}

.pb-2 {
  padding-bottom: 0.5rem;
}

.pb-2\.5 {
  padding-bottom: 0.625rem;
}

.pb-3 {
  padding-bottom: 0.75rem;
}

.pb-3\.5 {
  padding-bottom: 0.875rem;
}

.pb-3xl {
  padding-bottom: 64px;
}

.pb-4 {
  padding-bottom: 1rem;
}

.pb-6 {
  padding-bottom: 1.5rem;
}

.pb-8 {
  padding-bottom: 2rem;
}

.pb-\[34px\] {
  padding-bottom: 34px;
}

.pb-\[96px\] {
  padding-bottom: 96px;
}

.pb-lg {
  padding-bottom: 24px;
}

.pb-md {
  padding-bottom: 16px;
}

.pb-sm {
  padding-bottom: 8px;
}

.pb-xl {
  padding-bottom: 32px;
}

.pl-1 {
  padding-left: 0.25rem;
}

.pl-2 {
  padding-left: 0.5rem;
}

.pl-4 {
  padding-left: 1rem;
}

.pl-sm {
  padding-left: 8px;
}

.pr-2 {
  padding-right: 0.5rem;
}

.pr-4 {
  padding-right: 1rem;
}

.pr-6 {
  padding-right: 1.5rem;
}

.pr-sm {
  padding-right: 8px;
}

.pt-1 {
  padding-top: 0.25rem;
}

.pt-1\.5 {
  padding-top: 0.375rem;
}

.pt-2 {
  padding-top: 0.5rem;
}

.pt-2\.5 {
  padding-top: 0.625rem;
}

.pt-2xl {
  padding-top: 48px;
}

.pt-3 {
  padding-top: 0.75rem;
}

.pt-3\.5 {
  padding-top: 0.875rem;
}

.pt-4 {
  padding-top: 1rem;
}

.pt-6 {
  padding-top: 1.5rem;
}

.pt-8 {
  padding-top: 2rem;
}

.pt-\[50px\] {
  padding-top: 50px;
}

.pt-\[54px\] {
  padding-top: 54px;
}

.pt-\[60px\] {
  padding-top: 60px;
}

.pt-md {
  padding-top: 16px;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.text-\[10px\] {
  font-size: 10px;
}

.text-\[11\.5px\] {
  font-size: 11.5px;
}

.text-\[11px\] {
  font-size: 11px;
}

.text-\[12px\] {
  font-size: 12px;
}

.text-\[13px\] {
  font-size: 13px;
}

.text-\[14px\] {
  font-size: 14px;
}

.text-\[15px\] {
  font-size: 15px;
}

.text-\[16px\] {
  font-size: 16px;
}

.text-\[17px\] {
  font-size: 17px;
}

.text-\[18px\] {
  font-size: 18px;
}

.text-\[20px\] {
  font-size: 20px;
}

.text-\[22px\] {
  font-size: 22px;
}

.text-\[26px\] {
  font-size: 26px;
}

.text-\[9px\] {
  font-size: 9px;
}

.text-base {
  font-size: 13px;
}

.text-lg {
  font-size: 17px;
}

.text-md {
  font-size: 15px;
}

.text-sm {
  font-size: 12px;
}

.text-xl {
  font-size: 20px;
}

.text-xs {
  font-size: 10px;
}

.font-bold {
  font-weight: 700;
}

.font-extrabold {
  font-weight: 800;
}

.font-medium {
  font-weight: 500;
}

.font-normal {
  font-weight: 400;
}

.font-semibold {
  font-weight: 600;
}

.uppercase {
  text-transform: uppercase;
}

.lowercase {
  text-transform: lowercase;
}

.capitalize {
  text-transform: capitalize;
}

.italic {
  font-style: italic;
}

.leading-5 {
  line-height: 1.25rem;
}

.leading-6 {
  line-height: 1.5rem;
}

.leading-8 {
  line-height: 2rem;
}

.leading-\[15px\] {
  line-height: 15px;
}

.leading-\[16px\] {
  line-height: 16px;
}

.leading-\[17px\] {
  line-height: 17px;
}

.leading-\[18px\] {
  line-height: 18px;
}

.leading-\[19px\] {
  line-height: 19px;
}

.leading-\[20px\] {
  line-height: 20px;
}

.leading-\[21px\] {
  line-height: 21px;
}

.leading-\[22px\] {
  line-height: 22px;
}

.leading-\[24px\] {
  line-height: 24px;
}

.tracking-\[-0\.5px\] {
  letter-spacing: -0.5px;
}

.tracking-\[0\.2px\] {
  letter-spacing: 0.2px;
}

.tracking-\[0\.3px\] {
  letter-spacing: 0.3px;
}

.tracking-\[0\.4px\] {
  letter-spacing: 0.4px;
}

.tracking-\[0\.5px\] {
  letter-spacing: 0.5px;
}

.tracking-\[0\.8px\] {
  letter-spacing: 0.8px;
}

.tracking-\[1\.2px\] {
  letter-spacing: 1.2px;
}

.tracking-\[1\.4px\] {
  letter-spacing: 1.4px;
}

.tracking-tight {
  letter-spacing: -0.025em;
}

.tracking-wide {
  letter-spacing: 0.025em;
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.text-\[\#10b981\] {
  --tw-text-opacity: 1;
  color: rgb(16 185 129 / var(--tw-text-opacity));
}

.text-\[\#1F2937\] {
  --tw-text-opacity: 1;
  color: rgb(31 41 55 / var(--tw-text-opacity));
}

.text-\[\#1e40af\] {
  --tw-text-opacity: 1;
  color: rgb(30 64 175 / var(--tw-text-opacity));
}

.text-\[\#22d3ee\] {
  --tw-text-opacity: 1;
  color: rgb(34 211 238 / var(--tw-text-opacity));
}

.text-\[\#3b82f6\] {
  --tw-text-opacity: 1;
  color: rgb(59 130 246 / var(--tw-text-opacity));
}

.text-\[\#64748b\] {
  --tw-text-opacity: 1;
  color: rgb(100 116 139 / var(--tw-text-opacity));
}

.text-\[\#67e8f9\] {
  --tw-text-opacity: 1;
  color: rgb(103 232 249 / var(--tw-text-opacity));
}

.text-\[\#6B7280\] {
  --tw-text-opacity: 1;
  color: rgb(107 114 128 / var(--tw-text-opacity));
}

.text-\[\#6ee7b7\] {
  --tw-text-opacity: 1;
  color: rgb(110 231 183 / var(--tw-text-opacity));
}

.text-\[\#8c8c8c\] {
  --tw-text-opacity: 1;
  color: rgb(140 140 140 / var(--tw-text-opacity));
}

.text-\[\#94a3b8\] {
  --tw-text-opacity: 1;
  color: rgb(148 163 184 / var(--tw-text-opacity));
}

.text-\[\#a5b4fc\] {
  --tw-text-opacity: 1;
  color: rgb(165 180 252 / var(--tw-text-opacity));
}

.text-\[\#e0ecff\] {
  --tw-text-opacity: 1;
  color: rgb(224 236 255 / var(--tw-text-opacity));
}

.text-\[\#e2e8f0\] {
  --tw-text-opacity: 1;
  color: rgb(226 232 240 / var(--tw-text-opacity));
}

.text-\[\#ef4444\] {
  --tw-text-opacity: 1;
  color: rgb(239 68 68 / var(--tw-text-opacity));
}

.text-\[\#f59e0b\] {
  --tw-text-opacity: 1;
  color: rgb(245 158 11 / var(--tw-text-opacity));
}

.text-\[\#f87171\] {
  --tw-text-opacity: 1;
  color: rgb(248 113 113 / var(--tw-text-opacity));
}

.text-\[\#f8fafc\] {
  --tw-text-opacity: 1;
  color: rgb(248 250 252 / var(--tw-text-opacity));
}

.text-\[\#fbbf24\] {
  --tw-text-opacity: 1;
  color: rgb(251 191 36 / var(--tw-text-opacity));
}

.text-bgDark {
  --tw-text-opacity: 1;
  color: rgb(15 23 42 / var(--tw-text-opacity));
}

.text-blue-500 {
  --tw-text-opacity: 1;
  color: rgb(59 130 246 / var(--tw-text-opacity));
}

.text-blue-700 {
  --tw-text-opacity: 1;
  color: rgb(29 78 216 / var(--tw-text-opacity));
}

.text-error {
  --tw-text-opacity: 1;
  color: rgb(239 68 68 / var(--tw-text-opacity));
}

.text-gray-500 {
  --tw-text-opacity: 1;
  color: rgb(107 114 128 / var(--tw-text-opacity));
}

.text-gray-700 {
  --tw-text-opacity: 1;
  color: rgb(55 65 81 / var(--tw-text-opacity));
}

.text-gray-900 {
  --tw-text-opacity: 1;
  color: rgb(17 24 39 / var(--tw-text-opacity));
}

.text-primary {
  --tw-text-opacity: 1;
  color: rgb(30 64 175 / var(--tw-text-opacity));
}

.text-primaryLight {
  --tw-text-opacity: 1;
  color: rgb(59 130 246 / var(--tw-text-opacity));
}

.text-red-500 {
  --tw-text-opacity: 1;
  color: rgb(239 68 68 / var(--tw-text-opacity));
}

.text-secondaryLight {
  --tw-text-opacity: 1;
  color: rgb(16 185 129 / var(--tw-text-opacity));
}

.text-slate-100 {
  --tw-text-opacity: 1;
  color: rgb(241 245 249 / var(--tw-text-opacity));
}

.text-slate-200 {
  --tw-text-opacity: 1;
  color: rgb(226 232 240 / var(--tw-text-opacity));
}

.text-slate-300 {
  --tw-text-opacity: 1;
  color: rgb(203 213 225 / var(--tw-text-opacity));
}

.text-slate-400 {
  --tw-text-opacity: 1;
  color: rgb(148 163 184 / var(--tw-text-opacity));
}

.text-slate-50 {
  --tw-text-opacity: 1;
  color: rgb(248 250 252 / var(--tw-text-opacity));
}

.text-slate-500 {
  --tw-text-opacity: 1;
  color: rgb(100 116 139 / var(--tw-text-opacity));
}

.text-success {
  --tw-text-opacity: 1;
  color: rgb(16 185 129 / var(--tw-text-opacity));
}

.text-textMuted {
  --tw-text-opacity: 1;
  color: rgb(148 163 184 / var(--tw-text-opacity));
}

.text-textPrimary {
  --tw-text-opacity: 1;
  color: rgb(248 250 252 / var(--tw-text-opacity));
}

.text-textSecondary {
  --tw-text-opacity: 1;
  color: rgb(226 232 240 / var(--tw-text-opacity));
}

.text-textSubtle {
  --tw-text-opacity: 1;
  color: rgb(100 116 139 / var(--tw-text-opacity));
}

.text-warning {
  --tw-text-opacity: 1;
  color: rgb(245 158 11 / var(--tw-text-opacity));
}

.text-white {
  --tw-text-opacity: 1;
  color: rgb(255 255 255 / var(--tw-text-opacity));
}

.underline {
  text-decoration-line: underline;
}

.opacity-50 {
  opacity: 0.5;
}

.opacity-60 {
  opacity: 0.6;
}

.shadow {
  --tw-shadow: 0px 1px 4px rgba(0, 0, 0, 0.35);
  --tw-shadow-colored: 0px 1px 4px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.shadow-lg {
  --tw-shadow: 0px 4px 10px rgba(0, 0, 0, 0.35);
  --tw-shadow-colored: 0px 4px 10px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.shadow-md {
  --tw-shadow: 0px 3px 10px rgba(0, 0, 0, 0.35);
  --tw-shadow-colored: 0px 3px 10px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.shadow-sm {
  --tw-shadow:  0px 1px 1px rgba(0, 0, 0, 0.35);
  --tw-shadow-colored: 0px 1px 1px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.shadow-xl {
  --tw-shadow: 0px 6px 19px rgba(0, 0, 0, 0.35);
  --tw-shadow-colored: 0px 6px 19px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}

.shadow-black\/10 {
  --tw-shadow-color: rgb(0 0 0 / 0.1);
  --tw-shadow: var(--tw-shadow-colored);
}

.shadow-black\/25 {
  --tw-shadow-color: rgb(0 0 0 / 0.25);
  --tw-shadow: var(--tw-shadow-colored);
}

.shadow-black\/30 {
  --tw-shadow-color: rgb(0 0 0 / 0.3);
  --tw-shadow: var(--tw-shadow-colored);
}

.shadow-primary\/30 {
  --tw-shadow-color: rgb(30 64 175 / 0.3);
  --tw-shadow: var(--tw-shadow-colored);
}

.shadow-primaryLight\/40 {
  --tw-shadow-color: rgb(59 130 246 / 0.4);
  --tw-shadow: var(--tw-shadow-colored);
}

.outline {
  outline-style: solid;
}

.filter {
  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
}

.color-\[\#64748b\] {
  --tw-text-opacity: 1;
  color: rgb(100 116 139 / var(--tw-text-opacity));
}

.color-\[\#94a3b8\] {
  --tw-text-opacity: 1;
  color: rgb(148 163 184 / var(--tw-text-opacity));
}

.color-\[\#a78bfa\] {
  --tw-text-opacity: 1;
  color: rgb(167 139 250 / var(--tw-text-opacity));
}

.color-\[\#e2e8f0\] {
  --tw-text-opacity: 1;
  color: rgb(226 232 240 / var(--tw-text-opacity));
}

.color-\[\#f8fafc\] {
  --tw-text-opacity: 1;
  color: rgb(248 250 252 / var(--tw-text-opacity));
}

.color-white {
  --tw-text-opacity: 1;
  color: rgb(255 255 255 / var(--tw-text-opacity));
}
