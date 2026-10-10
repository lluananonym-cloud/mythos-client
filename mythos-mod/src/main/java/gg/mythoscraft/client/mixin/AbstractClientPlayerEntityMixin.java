package gg.mythoscraft.client.mixin;

import gg.mythoscraft.client.CapeManager;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Ersetzt Cape und Elytra durch das angelegte Mythos-Cape. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void mythos$cape(CallbackInfoReturnable<SkinTextures> cir) {
        Identifier cape = CapeManager.capeFor(((AbstractClientPlayerEntity) (Object) this).getUuid());
        if (cape == null) return;
        SkinTextures s = cir.getReturnValue();
        cir.setReturnValue(new SkinTextures(s.texture(), s.textureUrl(), cape, cape, s.model(), s.secure()));
    }
}
