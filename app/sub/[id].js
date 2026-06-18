import React, { useMemo, useState } from "react"
import {
View,
Text,
TextInput,
ScrollView,
TouchableOpacity,
Switch,
Alert,
Linking
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { useRouter, useLocalSearchParams } from "expo-router"

import { useTranslation } from "react-i18next"
import { useTheme } from "../../lib/theme"
import { useStore } from "../../lib/store"

import NavHeader from "../../components/NavHeader"
import Button from "../../components/Button"
import BrandAvatar from "../../components/BrandAvatar"

export default function SubscriptionDetail(){

const t = useTheme()
const r = useRouter()
const { t: tt } = useTranslation()
const { id } = useLocalSearchParams()

const subs = useStore(s => s.subs)
const updateSub = useStore(s => s.updateSub)
const archiveSub = useStore(s => s.archiveSub)
const deleteSub = useStore(s => s.deleteSub)

const sub = useMemo(()=>subs?.find(s=>String(s.id)===String(id)),[subs,id])

const [merchant,setMerchant] = useState(sub?.merchant || "")
const [price,setPrice] = useState(String(sub?.price || ""))
const [cycle,setCycle] = useState(sub?.cycle || "monthly")
const [active,setActive] = useState(sub?.active ?? true)

if(!sub){
return (
<SafeAreaView style={{flex:1,backgroundColor:t.bg}}>
<Text style={{padding:20,color:t.text}}>{tt("sub_screen.notFound")}</Text>
</SafeAreaView>
)
}

function save(){
updateSub?.(sub.id,{
merchant,
price: Number(price),
cycle,
active
})
Alert.alert(tt("sub_screen.savedTitle"), tt("sub_screen.savedBody"))
}

function archive(){
archiveSub?.(sub.id)
r.back()
}

function remove(){
Alert.alert(
tt("sub_screen.deleteTitle"),
tt("sub_screen.deleteBody"),
[
{text:tt("sub_screen.cancelLabel")},
{text:tt("sub_screen.deleteLabel"),style:"destructive",onPress:()=>{
deleteSub?.(sub.id)
r.replace("/(tabs)/home")
}}
]
)
}

const Card = ({children}) => (
<View
style={{
backgroundColor:t.surface,
borderRadius:22,
borderWidth:1,
borderColor:t.hairline,
padding:18,
marginBottom:14
}}
>
{children}
</View>
)

return (
<SafeAreaView style={{flex:1,backgroundColor:t.bg}}>

<NavHeader
title="Subscription"
onBack={()=>r.back()}
/>

<ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}>

{/* HEADER */}

<View
style={{
flexDirection:"row",
alignItems:"center",
marginBottom:14
}}
>

<BrandAvatar merchant={merchant} size={54}/>

<View style={{marginLeft:12,flex:1}}>
<Text style={{color:t.text,fontSize:20,fontWeight:"800"}}>
{merchant}
</Text>
<Text style={{color:t.subtext,marginTop:2}}>
Subscription details
</Text>
</View>

</View>


{/* TYPE */}

<Card>

<View style={{flexDirection:"row",alignItems:"center",marginBottom:10}}>
<Feather name="tag" size={18} color={t.subtext}/>
<Text style={{color:t.text,fontWeight:"700",marginLeft:8}}>
Type
</Text>
</View>

<View style={{flexDirection:"row",gap:10}}>

<TouchableOpacity
style={{
paddingVertical:10,
paddingHorizontal:18,
borderRadius:999,
backgroundColor:"rgba(124,92,255,0.14)"
}}
>
<Text style={{color:t.text,fontWeight:"700"}}>
Subscription
</Text>
</TouchableOpacity>

<TouchableOpacity
style={{
paddingVertical:10,
paddingHorizontal:18,
borderRadius:999,
borderWidth:1,
borderColor:t.hairline
}}
>
<Text style={{color:t.subtext,fontWeight:"700"}}>
Bill
</Text>
</TouchableOpacity>

</View>

</Card>


{/* STATUS */}

<Card>

<View
style={{
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between"
}}
>

<View>
<Text style={{color:t.text,fontWeight:"700"}}>
Status
</Text>
<Text style={{color:t.subtext,marginTop:2}}>
Active subscription
</Text>
</View>

<Switch
value={active}
onValueChange={setActive}
/>

</View>

</Card>


{/* DETAILS */}

<Card>

<View style={{flexDirection:"row",alignItems:"center",marginBottom:10}}>
<Feather name="edit-2" size={18} color={t.subtext}/>
<Text style={{color:t.text,fontWeight:"700",marginLeft:8}}>
Details
</Text>
</View>

<TextInput
value={merchant}
onChangeText={setMerchant}
placeholder="Merchant"
placeholderTextColor={t.subtext}
style={{
backgroundColor:t.bg,
padding:12,
borderRadius:12,
color:t.text,
marginBottom:10
}}
/>

<TextInput
value={price}
onChangeText={setPrice}
placeholder="Price"
placeholderTextColor={t.subtext}
keyboardType="numeric"
style={{
backgroundColor:t.bg,
padding:12,
borderRadius:12,
color:t.text
}}
/>

</Card>


{/* CANCEL */}

<Card>

<View style={{flexDirection:"row",alignItems:"center",marginBottom:10}}>
<Feather name="x-circle" size={18} color={t.subtext}/>
<Text style={{color:t.text,fontWeight:"700",marginLeft:8}}>
Cancel this subscription
</Text>
</View>

<Text style={{color:t.subtext,lineHeight:20}}>
Get exact steps for {merchant} — a direct cancel link, copy-paste email/chat templates, and a confirmation tracker.
</Text>

<View style={{height:14}}/>

<Button
title="Open Cancel Center"
onPress={()=>r.push({
  pathname:"/cancel-center",
  params:{
    name: merchant,
    domain: sub.domain || "",
    price: String(sub.amount ?? sub.price ?? ""),
    cadence: sub.cadence || sub.cycle || "monthly",
  },
})}
left={<Feather name="x-circle" size={16} color="#fff" />}
/>

</Card>


{/* DELETE / ARCHIVE */}

<Card>

<Text style={{color:t.text,fontWeight:"800",marginBottom:10}}>
Delete / Archive
</Text>

<View style={{flexDirection:"row",gap:10}}>

<Button
title="Archive"
variant="secondary"
onPress={archive}
/>

<Button
title="Delete"
variant="danger"
onPress={remove}
/>

</View>

</Card>


{/* SAVE */}

<Button
title="Save changes"
onPress={save}
/>

</ScrollView>
</SafeAreaView>
)
}