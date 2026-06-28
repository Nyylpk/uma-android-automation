import SearchableItem from "../SearchableItem"
import { Row } from "../ui/row"
import { Switch } from "../ui/switch"

/** Props for ToggleSetting. */
interface ToggleSettingProps {
    /** Unique search id, registered with the search registry via `SearchableItem`. */
    id: string
    /** Primary label, shown on the `Row` and indexed for search. */
    title: string
    /** Secondary description line, shown on the `Row` and indexed for search. */
    description: string
    /** Current on/off state of the switch. */
    checked: boolean
    /** Fired with the new state when the switch is toggled. */
    onCheckedChange: (checked: boolean) => void
    /** When provided and false, the row is hidden but stays searchable, falling back to its parent. */
    condition?: boolean
    /** Parent search id to highlight when this conditionally-hidden item is matched. */
    parentId?: string
}

/**
 * A boolean settings toggle: the standard `SearchableItem` > `Row` > `Switch` composition every settings page uses.
 * Collapses the repeated triple-nest and removes the need to type `title` / `description` twice (once for search, once for display).
 *
 * @param id Unique search id registered via `SearchableItem`.
 * @param title Primary label shown on the row and indexed for search.
 * @param description Secondary line shown on the row and indexed for search.
 * @param checked Current on/off state of the switch.
 * @param onCheckedChange Fired with the new state when the switch is toggled.
 * @param condition When provided and false, hides the row while keeping it searchable.
 * @param parentId Parent search id to highlight for a conditionally-hidden item.
 * @returns The composed searchable toggle row.
 */
const ToggleSetting = ({ id, title, description, checked, onCheckedChange, condition, parentId }: ToggleSettingProps) => (
    <SearchableItem id={id} title={title} description={description} condition={condition} parentId={parentId}>
        <Row title={title} description={description} right={<Switch checked={checked} onCheckedChange={onCheckedChange} />} />
    </SearchableItem>
)

export default ToggleSetting
