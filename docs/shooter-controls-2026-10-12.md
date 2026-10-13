# Shooter controls · October 12, 2026

Mobile: larger separated Fire and Aim targets; hold Fire and drag the same finger to aim while firing. Pointer capture keeps Fire held outside its visual bounds. Other fingers can move the joystick independently. Tap Aim to toggle sights, and drag it to adjust aim. Zoom scales look sensitivity. Both first- and third-person aiming use the same input gesture.

Desktop: click the world once to capture the mouse. Mouse motion turns the camera and weapon without dragging; left-click fires and right-click holds sights. Escape releases the cursor, and menus, typing, blur, and leaving the world clear capture/input. The capture click does not fire. Existing WASD, R reload, and Z fire-mode controls remain.

Validation: browser test with real pointer lock verifies mouse movement without a held button and Escape release. Pointer-event tests verify fire-and-drag, independent fingers, leaving the button, release/cancel, zoom sensitivity, and inactive-world guarding. Five viewport layout checks passed. Production bundle rebuilt. Tests use Chromium, not a physical phone.
