{pkgs}: {
  deps = [
    pkgs.ghostscript
    pkgs.unzip
    pkgs.jq
    pkgs.imagemagick
    pkgs.poppler_utils
    pkgs.chromium
    pkgs.postgresql
  ];
}
