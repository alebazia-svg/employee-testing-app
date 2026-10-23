portal-qr-window.png is a cropped screenshot of the actual production Workday
QR dialog (2026-10-23, version 1.14.1). Only the public QR posters/dialog are
included; employee records and account UI are outside the crop.

The previous single full-frame jsQR call returns null for this image. The
region-search regression test must find the appropriate department QR without
manual cropping. It is a screen image, not a physical iPhone camera photograph;
physical-device performance and camera/monitor artefacts are not established
by this fixture. No stronger claim should be made from this test.

iphone-monitor-retail.jpg is the owner's supplied camera photograph of the public
retail QR poster displayed on a monitor (2026-10-23). Full-resolution jsQR fails;
the automatic smaller full-frame pass must decode it without manual cropping.
This verifies image decoding on this actual photo, not iPhone runtime timing.
