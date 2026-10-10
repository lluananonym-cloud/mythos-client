package gg.mythoscraft.client.mixin;

import gg.mythoscraft.client.MythosClient;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Setzt das Mythoscraft-Logo vor den Namen von Spielern, die Mythos Client nutzen (Namensschild). */
@Mixin(PlayerEntity.class)
public abstract class PlayerEntityMixin {
    @Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
    private void mythos$addLogo(CallbackInfoReturnable<Text> cir) {
        PlayerEntity self = (PlayerEntity) (Object) this;
        if (!self.getWorld().isClient) return;
        Boolean plus = MythosClient.playerStatus(self.getUuid());
        if (plus == null) return;
        MutableText name = MythosClient.icon().append(Text.literal(" "));
        if (plus) name.append(Text.literal("+").formatted(Formatting.GOLD)).append(Text.literal(" "));
        cir.setReturnValue(name.append(cir.getReturnValue()));
    }
}
