import { THEME } from "../theme"

describe("theme tokens", () => {
    it("exposes light and dark variants with the same key shape", () => {
        expect(Object.keys(THEME.light).sort()).toEqual(Object.keys(THEME.dark).sort())
    })

    it("preserves pre-existing legacy tokens so unmigrated code keeps working", () => {
        const legacy = ["background", "foreground", "card", "muted", "mutedForeground", "destructive", "border", "ring", "ripple", "rippleInverse"]
        for (const variant of ["dark", "light"] as const) {
            for (const key of legacy) {
                expect(THEME[variant]).toHaveProperty(key)
            }
        }
    })

    it("dark variant uses the locked-in semantic palette", () => {
        expect(THEME.dark.bg).toBe("#0a0a0a")
        expect(THEME.dark.surface).toBe("#111114")
        expect(THEME.dark.surfaceRaised).toBe("#18181b")
        expect(THEME.dark.borderHair).toBe("#1f1f23")
        expect(THEME.dark.borderStrong).toBe("#2a2a30")
        expect(THEME.dark.text).toBe("#ededed")
        expect(THEME.dark.textMuted).toBe("#6b6b73")
        expect(THEME.dark.brand).toBe("#22d3ee")
        expect(THEME.dark.onBrand).toBe("#0a0a0a")
    })

    it("light variant uses the warm-stone palette", () => {
        expect(THEME.light.bg).toBe("#fafaf9")
        expect(THEME.light.surface).toBe("#ffffff")
        expect(THEME.light.surfaceRaised).toBe("#ffffff")
        expect(THEME.light.borderHair).toBe("#e7e5e4")
        expect(THEME.light.text).toBe("#1c1917")
        expect(THEME.light.textMuted).toBe("#78716c")
        expect(THEME.light.brand).toBe("#0891b2")
        expect(THEME.light.onBrand).toBe("#ffffff")
    })

    it("exposes brand-tinted surface and border tokens", () => {
        expect(THEME.dark.brandSubtle).toMatch(/^rgba\(/)
        expect(THEME.dark.brandBorder).toMatch(/^rgba\(/)
        expect(THEME.light.brandSubtle).toMatch(/^rgba\(/)
        expect(THEME.light.brandBorder).toMatch(/^rgba\(/)
    })

    it("exposes glass tokens for translucent surfaces", () => {
        expect(THEME.dark.glassBackground).toMatch(/^rgba\(/)
        expect(THEME.dark.glassBorder).toMatch(/^rgba\(/)
        expect(THEME.light.glassBackground).toMatch(/^rgba\(/)
    })
})
