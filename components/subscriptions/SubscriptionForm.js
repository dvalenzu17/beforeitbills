export default function SubscriptionForm({
    initialValues,
    onSubmit,
    submitLabel = "Save"
  }) {
  
    const t = useTheme()
  
    const [merchant, setMerchant] = useState(initialValues.merchant || "")
    const [amount, setAmount] = useState(String(initialValues.amount || ""))
    const [currency, setCurrency] = useState(initialValues.currency || "USD")
    const [cadence, setCadence] = useState(initialValues.cadence || "monthly")
    const [renewalDate, setRenewalDate] = useState(initialValues.renewalDate || null)
    const [shared, setShared] = useState(initialValues.shared || false)
    const [trial, setTrial] = useState(initialValues.trial || false)
  
    function save() {
  
      onSubmit({
        merchant,
        amount: Number(amount),
        currency,
        cadence,
        renewalDate,
        shared,
        trial
      })
    }
  
    return (
  
      <ScrollView contentContainerStyle={{ padding: 16 }}>
  
        <Card>
  
          <FormLabel>Merchant</FormLabel>
  
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Netflix"
            style={inputStyle(t)}
          />
  
          <FormLabel>Amount</FormLabel>
  
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            style={inputStyle(t)}
          />
  
          <FormLabel>Currency</FormLabel>
  
          <CurrencyPicker
            value={currency}
            onChange={setCurrency}
          />
  
          <FormLabel>Cadence</FormLabel>
  
          <CadenceSelector
            value={cadence}
            onChange={setCadence}
          />
  
          <FormLabel>Renews on</FormLabel>
  
          <DatePicker
            value={renewalDate}
            onChange={setRenewalDate}
          />
  
        </Card>
  
        <Card>
  
          <ToggleRow
            label="Shared expense"
            value={shared}
            onChange={setShared}
          />
  
        </Card>
  
        <Card>
  
          <ToggleRow
            label="Trial"
            value={trial}
            onChange={setTrial}
          />
  
        </Card>
  
        <Button
          title={submitLabel}
          onPress={save}
        />
  
      </ScrollView>
    )
  }