{pkgs}: {
  deps = [
    pkgs.graphicsmagick
    pkgs.ghostscript
    pkgs.unzip
    pkgs.jq
    pkgs.imagemagick
    pkgs.poppler_utils
    pkgs.chromium
    pkgs.postgresql
    pkgs.python311
    pkgs.python311Packages.pandas
    pkgs.python311Packages.openpyxl
  ];
}
