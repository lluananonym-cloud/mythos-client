package gg.mythoscraft.client.mixin;

import net.minecraft.client.option.SimpleOption;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Setzt einen Optionswert ohne Bereichsprüfung (für Fullbright: Helligkeit über 100 %). */
@Mixin(SimpleOption.class)
public interface SimpleOptionAccessor {
    @Accessor("value")
    void mythos$setValue(Object value);
}
