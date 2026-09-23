{
  description = "Development environment for Liam White's Astro blog";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-26.05-darwin";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
    in
    {
      devShells = nixpkgs.lib.genAttrs systems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          wrangler = pkgs.writeShellApplication {
            name = "wrangler";
            runtimeInputs = [ pkgs.nodejs ];
            text = ''
              if [ ! -f node_modules/wrangler/bin/wrangler.js ]; then
                echo "Run make install from the repository root first." >&2
                exit 1
              fi
              exec node node_modules/wrangler/bin/wrangler.js "$@"
            '';
          };
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.bun pkgs.git pkgs.gnumake pkgs.nodejs wrangler ];
          };
        });
    };
}
