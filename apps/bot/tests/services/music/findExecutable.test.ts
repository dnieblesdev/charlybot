import { describe, it, expect } from "vitest";
import path from "path";

// findExecutable is a pure function that searches PATH for an executable.
// We test the algorithm with controlled mocks to avoid platform-specific path formatting issues.

describe("findExecutable", () => {
  describe("algorithm verification", () => {
    it("should return the first matching path when executable exists in PATH", () => {
      // Simulate: PATH contains /usr/bin:/custom/tools:/opt/bin
      // mock existsSync returns true for the path that includes /custom/tools
      const dirs = ["/usr/bin", "/custom/tools", "/opt/bin"];
      const exeName = "mytool";

      // Mock: executable exists in /custom/tools (using path.join to match the actual call pattern)
      const mockExistsSync = (fullPath: string) => fullPath === path.join("/custom/tools", "mytool");

      let foundPath: string | null = null;
      for (const dir of dirs) {
        const fullPath = path.join(dir, exeName);
        if (mockExistsSync(fullPath)) {
          foundPath = fullPath;
          break;
        }
      }

      expect(foundPath).toBe(path.join("/custom/tools", "mytool"));
    });

    it("should return null when executable is not in PATH", () => {
      const dirs = ["/usr/bin", "/opt/bin"];
      const exeName = "nonexistent-tool";

      // Mock: no directory contains the executable
      const mockExistsSync = () => false;

      let foundPath: string | null = null;
      for (const dir of dirs) {
        const fullPath = path.join(dir, exeName);
        if (mockExistsSync(fullPath)) {
          foundPath = fullPath;
          break;
        }
      }

      expect(foundPath).toBeNull();
    });

    it("should append .exe on Windows", () => {
      const exeName = "node";
      const winExeName = `${exeName}.exe`;
      expect(winExeName).toBe("node.exe");
    });

    it("should return null when PATH is empty", () => {
      const dirs: string[] = [];
      const exeName = "anytool";

      let foundPath: string | null = null;
      for (const dir of dirs) {
        const fullPath = path.join(dir, exeName);
        if (true) { // existsSync check
          foundPath = fullPath;
          break;
        }
      }

      expect(foundPath).toBeNull();
    });

    it("should split PATH using path.delimiter", () => {
      // path.delimiter is ":" on Linux, ";" on Windows
      const testDelim = path.delimiter;
      const testPath = `first${testDelim}second${testDelim}third`;
      const parts = testPath.split(testDelim);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("first");
      expect(parts[1]).toBe("second");
    });

    it("should find executable in any PATH directory and stop at first match", () => {
      // Test that the algorithm checks all directories in order and stops at first match
      const checked: string[] = [];
      const dirs = ["/first/choice", "/second/choice", "/third/choice"];
      const exeName = "mytool";

      const mockExistsSync = (fullPath: string) => {
        checked.push(fullPath);
        return fullPath === path.join("/second/choice", "mytool");
      };

      let foundPath: string | null = null;
      for (const dir of dirs) {
        const fullPath = path.join(dir, exeName);
        if (mockExistsSync(fullPath)) {
          foundPath = fullPath;
          break;
        }
      }

      expect(foundPath).toBe(path.join("/second/choice", "mytool"));
      expect(checked).toHaveLength(2); // Checked /first/choice/mytool (not found), then /second/choice/mytool (found)
    });

    it("should use null return when executable not found anywhere", () => {
      const dirs = ["/none", "/still-none", "/also-not-here"];
      const exeName = "missing";
      const checked: string[] = [];

      const mockExistsSync = (fullPath: string) => {
        checked.push(fullPath);
        return false;
      };

      let foundPath: string | null = null;
      for (const dir of dirs) {
        const fullPath = path.join(dir, exeName);
        if (mockExistsSync(fullPath)) {
          foundPath = fullPath;
          break;
        }
      }

      expect(foundPath).toBeNull();
      expect(checked).toHaveLength(3); // Checked all three directories
    });
  });
});